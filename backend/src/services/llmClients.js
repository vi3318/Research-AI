/**
 * LLM Clients Service
 * 
 * Provides unified interface for multiple LLM providers:
 * - Cerebras (primary, ultra-fast inference)
 * - Hugging Face Hub (fallback)
 * - Google Gemini (secondary/optional)
 * 
 * Supports ensemble calls with confidence aggregation
 */

const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class LLMClients {
  constructor() {
    this.providers = {
      cerebras: {
        available: !!process.env.CEREBRAS_API_KEY,
        baseURL: 'https://api.cerebras.ai/v1',
        apiKey: process.env.CEREBRAS_API_KEY,
        defaultModel: 'llama3.1-70b', // Use 70B for better humanization quality
        maxTokens: 8192,
        temperature: 0.7
      },
      huggingface: {
        available: !!process.env.HUGGINGFACE_API_KEY,
        baseURL: 'https://api-inference.huggingface.co/models',
        apiKey: process.env.HUGGINGFACE_API_KEY,
        defaultModel: 'meta-llama/Meta-Llama-3-8B-Instruct',
        maxTokens: 4096,
        temperature: 0.7
      },
      gemini: {
        available: !!process.env.GEMINI_API_KEY,
        apiKey: process.env.GEMINI_API_KEY,
        defaultModel: 'gemini-2.5-flash',
        maxTokens: 8192,
        temperature: 0.7
      }
    };

    // Initialize Gemini client if available
    if (this.providers.gemini.available) {
      this.geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }

    // Track provider health
    this.healthStatus = {
      cerebras: { lastSuccess: null, failureCount: 0 },
      huggingface: { lastSuccess: null, failureCount: 0 },
      gemini: { lastSuccess: null, failureCount: 0 }
    };
  }

  /**
   * Call Cerebras API (Primary - Ultra Fast)
   * Average response time: ~0.5-2 seconds
   */
  async callCerebras(prompt, options = {}) {
    console.log('📡 [Cerebras] Starting API call...');
    
    if (!this.providers.cerebras.available) {
      console.error('❌ [Cerebras] API key not configured');
      throw new Error('Cerebras API key not configured');
    }

    const config = this.providers.cerebras;
    const model = options.model || config.defaultModel;

    console.log('📡 [Cerebras] Config:', {
      baseURL: config.baseURL,
      model: model,
      hasApiKey: !!config.apiKey,
      apiKeyPrefix: config.apiKey ? config.apiKey.substring(0, 10) + '...' : 'none'
    });

    try {
      console.log('📡 [Cerebras] Making POST request to:', `${config.baseURL}/chat/completions`);
      
      const requestBody = {
        model: model,
        messages: [
          {
            role: 'system',
            content: options.systemPrompt || 'You are a helpful AI research assistant specialized in academic analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: options.maxTokens || config.maxTokens,
        temperature: options.temperature ?? config.temperature,
        top_p: options.topP || 0.9,
        stream: false
      };
      
      console.log('📡 [Cerebras] Request details:', {
        model: requestBody.model,
        messageCount: requestBody.messages.length,
        maxTokens: requestBody.max_tokens,
        temperature: requestBody.temperature,
        promptLength: prompt.length
      });
      
      const response = await axios.post(
        `${config.baseURL}/chat/completions`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: options.timeout || 30000
        }
      );

      console.log('✅ [Cerebras] Response received:', {
        status: response.status,
        hasChoices: !!response.data.choices,
        choiceCount: response.data.choices?.length
      });

      const output = response.data.choices[0].message.content;
      const usage = response.data.usage || {};

      console.log('✅ [Cerebras] Success:', {
        outputLength: output.length,
        tokensUsed: usage.total_tokens || 0
      });

      // Update health status
      this.healthStatus.cerebras.lastSuccess = new Date();
      this.healthStatus.cerebras.failureCount = 0;

      return {
        provider: 'cerebras',
        model: model,
        output: output,
        confidence: this._calculateProviderConfidence(output, 'cerebras'),
        metadata: {
          tokensUsed: usage.total_tokens || 0,
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          latency: response.headers['x-response-time'] || null
        }
      };
    } catch (error) {
      console.error('❌ [Cerebras] API call failed:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        stack: error.stack
      });
      
      this.healthStatus.cerebras.failureCount++;
      throw new Error(`Cerebras API error: ${error.message}`);
    }
  }

  /**
   * Call Hugging Face Hub (Fallback)
   * Supports various open-source models
   */
  async callHuggingFace(prompt, options = {}) {
    if (!this.providers.huggingface.available) {
      throw new Error('Hugging Face API key not configured');
    }

    const config = this.providers.huggingface;
    const model = options.model || config.defaultModel;

    try {
      const response = await axios.post(
        `${config.baseURL}/${model}`,
        {
          inputs: prompt,
          parameters: {
            max_new_tokens: options.maxTokens || config.maxTokens,
            temperature: options.temperature ?? config.temperature,
            top_p: options.topP || 0.9,
            do_sample: true,
            return_full_text: false
          },
          options: {
            wait_for_model: true,
            use_cache: false
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: options.timeout || 60000 // HF can be slower
        }
      );

      // Handle HF response format (can be array or object)
      const output = Array.isArray(response.data) 
        ? response.data[0].generated_text 
        : response.data.generated_text;

      // Update health status
      this.healthStatus.huggingface.lastSuccess = new Date();
      this.healthStatus.huggingface.failureCount = 0;

      return {
        provider: 'huggingface',
        model: model,
        output: output,
        confidence: this._calculateProviderConfidence(output, 'huggingface'),
        metadata: {
          tokensUsed: output.split(' ').length, // Approximate
          latency: null
        }
      };
    } catch (error) {
      this.healthStatus.huggingface.failureCount++;
      throw new Error(`Hugging Face API error: ${error.message}`);
    }
  }

  /**
   * Call Google Gemini (Secondary/Optional)
   * High quality, good for complex analysis
   */
  async callGemini(prompt, options = {}) {
    if (!this.providers.gemini.available) {
      throw new Error('Gemini API key not configured');
    }

    const config = this.providers.gemini;
    const modelName = options.model || config.defaultModel;

    try {
      const model = this.geminiClient.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          maxOutputTokens: options.maxTokens || config.maxTokens,
          temperature: options.temperature ?? config.temperature,
          topP: options.topP || 0.9,
          responseMimeType: options.jsonMode ? "application/json" : undefined,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_NONE",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE",
          },
        ],
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      // Check for safety blocking
      if (!response.candidates || response.candidates.length === 0) {
        console.warn('⚠️ Gemini: No candidates returned (likely blocked by safety filters)');
        throw new Error('Response blocked by safety filters');
      }
      
      const candidate = response.candidates[0];
      if (candidate.finishReason === 'SAFETY') {
        console.warn('⚠️ Gemini: Response blocked by safety filters');
        throw new Error('Response blocked by safety filters');
      }
      
      const output = response.text();

      console.log(`📝 Gemini response:`, {
        hasText: !!output,
        textLength: output?.length || 0,
        textPreview: output?.substring(0, 150),
        usageMetadata: response.usageMetadata,
        finishReason: candidate.finishReason
      });

      // Update health status
      this.healthStatus.gemini.lastSuccess = new Date();
      this.healthStatus.gemini.failureCount = 0;

      return {
        provider: 'gemini',
        model: modelName,
        output: output,
        confidence: this._calculateProviderConfidence(output, 'gemini'),
        metadata: {
          tokensUsed: response.usageMetadata?.totalTokenCount || 0,
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          latency: null,
          finishReason: candidate.finishReason
        }
      };
    } catch (error) {
      this.healthStatus.gemini.failureCount++;
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  /**
   * Call Ensemble - Send to multiple providers and aggregate results
   * 
   * @param {string} prompt - The prompt to send
   * @param {object} options - Configuration options
   * @param {string[]} options.providers - Providers to use (default: all available)
   * @param {string} options.aggregation - 'consensus', 'best', or 'all' (default: 'consensus')
   * @param {number} options.minProviders - Minimum providers needed (default: 2)
   * @returns {object} Aggregated response with confidence scores
   */
  async callEnsemble(prompt, options = {}) {
    const requestedProviders = options.providers || ['cerebras', 'huggingface', 'gemini'];
    const availableProviders = requestedProviders.filter(p => this.providers[p]?.available);

    if (availableProviders.length === 0) {
      throw new Error('No LLM providers available. Please configure API keys.');
    }

    const minProviders = options.minProviders || Math.min(2, availableProviders.length);

    // Call all providers in parallel
    const providerCalls = availableProviders.map(async (providerName) => {
      try {
        switch (providerName) {
          case 'cerebras':
            return await this.callCerebras(prompt, options);
          case 'huggingface':
            return await this.callHuggingFace(prompt, options);
          case 'gemini':
            return await this.callGemini(prompt, options);
          default:
            return null;
        }
      } catch (error) {
        console.error(`Provider ${providerName} failed:`, error.message);
        return null;
      }
    });

    const results = (await Promise.all(providerCalls)).filter(r => r !== null);

    if (results.length < minProviders) {
      throw new Error(`Ensemble failed: Only ${results.length}/${minProviders} providers responded`);
    }

    // Calculate agreement/similarity between outputs
    const similarityMatrix = this._calculateSimilarityMatrix(results);
    const avgSimilarity = this._averageSimilarity(similarityMatrix);

    // Aggregate based on strategy
    let aggregatedOutput;
    let aggregationMethod;

    switch (options.aggregation || 'consensus') {
      case 'best':
        // Return highest confidence output
        const best = results.reduce((prev, curr) => 
          curr.confidence > prev.confidence ? curr : prev
        );
        aggregatedOutput = best.output;
        aggregationMethod = 'best_confidence';
        break;

      case 'all':
        // Return all outputs
        aggregatedOutput = results.map(r => r.output);
        aggregationMethod = 'all_outputs';
        break;

      case 'consensus':
      default:
        // Return most common output or weighted blend
        aggregatedOutput = this._findConsensusOutput(results, similarityMatrix);
        aggregationMethod = 'consensus';
        break;
    }

    // Calculate ensemble confidence
    const ensembleConfidence = this._calculateEnsembleConfidence(
      results,
      avgSimilarity,
      options
    );

    return {
      success: true,
      output: aggregatedOutput,
      confidence: ensembleConfidence,
      aggregationMethod: aggregationMethod,
      providers: results.map(r => ({
        provider: r.provider,
        model: r.model,
        confidence: r.confidence,
        output: r.output,
        metadata: r.metadata
      })),
      metrics: {
        providersUsed: results.length,
        providersRequested: availableProviders.length,
        averageSimilarity: avgSimilarity,
        totalTokensUsed: results.reduce((sum, r) => sum + (r.metadata.tokensUsed || 0), 0)
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate provider-specific confidence based on output characteristics
   */
  _calculateProviderConfidence(output, provider) {
    if (!output || output.trim().length === 0) return 0.0;

    let confidence = 0.5; // Base confidence

    // Length-based confidence (too short or too long reduces confidence)
    const wordCount = output.split(/\s+/).length;
    if (wordCount > 50 && wordCount < 2000) {
      confidence += 0.2;
    } else if (wordCount < 10) {
      confidence -= 0.2;
    }

    // Structure-based confidence (bullet points, sections)
    if (output.includes('\n-') || output.includes('\n•') || output.includes('\n*')) {
      confidence += 0.1;
    }

    // Keyword presence (research terms)
    const researchKeywords = ['research', 'study', 'findings', 'methodology', 'results', 'analysis'];
    const keywordCount = researchKeywords.filter(kw => 
      output.toLowerCase().includes(kw)
    ).length;
    confidence += (keywordCount / researchKeywords.length) * 0.1;

    // Provider-specific adjustments
    if (provider === 'cerebras') confidence += 0.05; // Primary provider bonus
    if (provider === 'gemini') confidence += 0.05;   // High quality model bonus

    return Math.min(Math.max(confidence, 0.0), 1.0);
  }

  /**
   * Calculate similarity matrix between provider outputs
   * Uses Jaccard similarity on word sets
   */
  _calculateSimilarityMatrix(results) {
    const matrix = [];
    
    for (let i = 0; i < results.length; i++) {
      matrix[i] = [];
      const words1 = new Set(results[i].output.toLowerCase().split(/\s+/));
      
      for (let j = 0; j < results.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          const words2 = new Set(results[j].output.toLowerCase().split(/\s+/));
          const intersection = new Set([...words1].filter(w => words2.has(w)));
          const union = new Set([...words1, ...words2]);
          matrix[i][j] = intersection.size / union.size;
        }
      }
    }
    
    return matrix;
  }

  /**
   * Calculate average similarity across all provider pairs
   */
  _averageSimilarity(matrix) {
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < matrix.length; i++) {
      for (let j = i + 1; j < matrix[i].length; j++) {
        sum += matrix[i][j];
        count++;
      }
    }
    
    return count > 0 ? sum / count : 0;
  }

  /**
   * Find consensus output based on similarity and confidence
   */
  _findConsensusOutput(results, similarityMatrix) {
    // Calculate aggregate score for each output
    const scores = results.map((result, idx) => {
      const avgSimilarityToOthers = similarityMatrix[idx].reduce((a, b) => a + b, 0) / similarityMatrix[idx].length;
      return avgSimilarityToOthers * 0.6 + result.confidence * 0.4;
    });

    // Return output with highest score
    const bestIdx = scores.indexOf(Math.max(...scores));
    return results[bestIdx].output;
  }

  /**
   * Calculate ensemble confidence score
   */
  _calculateEnsembleConfidence(results, avgSimilarity, options) {
    // Average provider confidence
    const avgProviderConf = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    // Agreement bonus (higher similarity = higher confidence)
    const agreementBonus = avgSimilarity * 0.3;

    // Provider count bonus
    const providerBonus = Math.min(results.length / 3, 1.0) * 0.1;

    const totalConfidence = (avgProviderConf * 0.6) + agreementBonus + providerBonus;

    return Math.min(Math.max(totalConfidence, 0.0), 1.0);
  }

  /**
   * Get health status of all providers
   */
  getHealthStatus() {
    return {
      providers: Object.keys(this.providers).map(name => ({
        name,
        available: this.providers[name].available,
        lastSuccess: this.healthStatus[name].lastSuccess,
        failureCount: this.healthStatus[name].failureCount,
        status: this._getProviderStatus(name)
      }))
    };
  }

  _getProviderStatus(name) {
    if (!this.providers[name].available) return 'unavailable';
    if (this.healthStatus[name].failureCount > 5) return 'degraded';
    if (this.healthStatus[name].lastSuccess) return 'healthy';
    return 'unknown';
  }

  /**
   * Simple single-provider call with automatic fallback
   */
  async callWithFallback(prompt, options = {}) {
    const preferredOrder = options.preferredOrder || ['cerebras', 'gemini', 'huggingface'];
    
    console.log(`🔄 LLM Fallback - Trying providers in order: ${preferredOrder.join(' → ')}`);
    
    for (const provider of preferredOrder) {
      if (!this.providers[provider]?.available) {
        console.log(`⏭️  Skipping ${provider} (not configured)`);
        continue;
      }
      
      try {
        console.log(`🚀 Trying ${provider}...`);
        let result;
        switch (provider) {
          case 'cerebras':
            result = await this.callCerebras(prompt, options);
            break;
          case 'huggingface':
            result = await this.callHuggingFace(prompt, options);
            break;
          case 'gemini':
            result = await this.callGemini(prompt, options);
            break;
        }
        
        if (result && result.output) {
          console.log(`✅ ${provider} succeeded (${result.output.length} chars)`);
          return result;
        } else {
          console.warn(`⚠️  ${provider} returned empty output`);
          continue;
        }
      } catch (error) {
        console.warn(`❌ Provider ${provider} failed: ${error.message}`);
        continue;
      }
    }
    
    throw new Error('All LLM providers failed');
  }

  /**
   * Humanize Text - Transform AI-generated text to sound natural
   * Primary: Cerebras Llama 3.1 70B (fastest + best instruction following)
   * Fallback: Gemini 2.0 Flash → HuggingFace
   * Sandbox: Local paraphraser if no keys available
   * 
   * @param {string} text - Text to humanize
   * @param {Object} options - Configuration
   * @param {string} options.provider - Force specific provider
   * @param {number} options.temperature - Sampling temperature (0-1, default 0.8)
   * @param {number} options.maxRetries - Retry attempts on failure
   * @returns {Promise<Object>} { rewritten, provider, latency_ms, usage }
   */
  async humanizeText(text, options = {}) {
    const startTime = Date.now();
    
    console.log('🧠 [Humanizer] Starting humanization process:', {
      textLength: text.length,
      provider: options.provider || 'auto',
      temperature: options.temperature || 0.8
    });
    
    // Validate input
    if (!text || typeof text !== 'string') {
      console.error('❌ [Humanizer] Invalid input - text must be a non-empty string');
      throw new Error('Text must be a non-empty string');
    }

    const estimatedTokens = Math.ceil(text.length / 4);
    console.log('🧠 [Humanizer] Estimated tokens:', estimatedTokens);
    
    if (estimatedTokens > 4000) {
      console.error('❌ [Humanizer] Text too long:', estimatedTokens, 'tokens');
      throw new Error(`Text too long (${estimatedTokens} tokens). Maximum 4000 tokens.`);
    }

    // Retry configuration
    const maxRetries = options.maxRetries || 3;
    const retryDelay = 1000; // 1 second
    
    // Determine provider order - Cerebras primary (fastest + Llama 3.1 70B excellent for rewriting)
    let providerOrder = ['cerebras', 'gemini', 'huggingface'];
    if (options.provider) {
      providerOrder = [options.provider, ...providerOrder.filter(p => p !== options.provider)];
    }

    console.log('🧠 [Humanizer] Provider order:', providerOrder);

    // Enhanced prompt optimized for Cerebras Llama 3.1 70B
    const prompt = `You are an expert at rewriting AI-generated text to sound natural and human-written.

Rewrite the text below following these rules:
1. Remove AI-like phrases: "Furthermore", "Additionally", "In conclusion", "It is important to note", "Moreover"
2. Use simple, direct language: "use" instead of "utilize", "help" instead of "facilitate"
3. Vary sentence length and structure for natural flow
4. Add casual transitions: "but", "so", "and", "because", "plus"
5. Keep all technical information and facts accurate
6. Maintain similar length to original (±10%)
7. Do NOT add explanations or extra content
8. Return ONLY the rewritten text

Text to humanize:
${text}`;

    console.log('🧠 [Humanizer] Prompt length:', prompt.length);

    // Try providers in order with retries
    let lastError;
    for (const providerName of providerOrder) {
      console.log(`🧠 [Humanizer] Trying provider: ${providerName}`);
      
      if (!this.providers[providerName]?.available) {
        console.warn(`⚠️ [Humanizer] Provider ${providerName} not available`);
        continue;
      }

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`🧠 [Humanizer] Attempt ${attempt}/${maxRetries} with ${providerName}`);
        
        try {
          let result;

          switch (providerName) {
            case 'cerebras':
              console.log('🧠 [Humanizer] Calling Cerebras...');
              // Cerebras Llama 3.1 70B - optimized for instruction following
              result = await this.callCerebras(prompt, {
                temperature: options.temperature || 0.8, // Higher for more creative rewriting
                maxTokens: options.maxTokens || 3000
              });
              console.log('✅ [Humanizer] Cerebras call successful');
              break;
            case 'gemini':
              console.log('🧠 [Humanizer] Calling Gemini...');
              // Gemini 2.0 Flash - good fallback for creative tasks
              result = await this.callGemini(prompt, {
                temperature: options.temperature || 0.8,
                maxTokens: options.maxTokens || 3000,
                jsonMode: false // Plain text output
              });
              console.log('✅ [Humanizer] Gemini call successful');
              break;
            case 'huggingface':
              console.log('🧠 [Humanizer] Calling HuggingFace...');
              result = await this.callHuggingFace(prompt, {
                temperature: options.temperature || 0.8,
                maxTokens: options.maxTokens || 3000
              });
              console.log('✅ [Humanizer] HuggingFace call successful');
              break;
          }

          const latency = Date.now() - startTime;
          const rewrittenText = result.output || result.text || result.response || text;

          console.log(`✅ [Humanizer] Humanization successful via ${providerName}:`, {
            originalLength: text.length,
            rewrittenLength: rewrittenText.length,
            latency: `${latency}ms`
          });

          return {
            rewritten: rewrittenText,
            provider: providerName,
            model: result.model || this.providers[providerName].defaultModel,
            latency_ms: latency,
            usage: {
              prompt_tokens: estimatedTokens,
              completion_tokens: Math.ceil((rewrittenText?.length || 0) / 4),
              total_tokens: estimatedTokens + Math.ceil((rewrittenText?.length || 0) / 4)
            }
          };

        } catch (error) {
          lastError = error;
          console.error(`❌ [Humanizer] ${providerName} attempt ${attempt}/${maxRetries} failed:`, error.message);
          console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
          });
          
          // Don't retry on client errors (4xx)
          if (error.response?.status >= 400 && error.response?.status < 500) {
            console.error(`❌ [Humanizer] Client error (${error.response.status}), skipping retries`);
            break;
          }

          if (attempt < maxRetries) {
            const waitTime = retryDelay * attempt;
            console.log(`⏳ [Humanizer] Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
    }

    // If all providers failed, use sandbox mode
    console.warn('All LLM providers failed, using sandbox mode');
    return this._sandboxHumanize(text, Date.now() - startTime);
  }

  /**
   * Sandbox mode - Simple rule-based paraphraser for offline development
   * No API keys required
   */
  _sandboxHumanize(text, baseLatency = 0) {
    const startTime = Date.now();
    
    let rewritten = text;
    
    // Simple transformations to make text sound more human
    const replacements = [
      [/\bUtilize\b/gi, 'Use'],
      [/\bFacilitate\b/gi, 'Help'],
      [/\bImplement\b/gi, 'Put into practice'],
      [/\bMethodology\b/gi, 'Method'],
      [/\bLeverage\b/gi, 'Use'],
      [/\bIn order to\b/gi, 'To'],
      [/\bDue to the fact that\b/gi, 'Because'],
      [/\bAt this point in time\b/gi, 'Now'],
      [/\bIt is important to note that\b/gi, 'Note that'],
      [/\bHowever,\b/g, 'But'],
      [/\bTherefore,\b/g, 'So'],
      [/\bFurthermore,\b/g, 'Also'],
      [/\bAdditionally,\b/g, 'Plus'],
      [/\bObtain\b/gi, 'Get'],
      [/\bPurchase\b/gi, 'Buy']
    ];
    
    replacements.forEach(([pattern, replacement]) => {
      rewritten = rewritten.replace(pattern, replacement);
    });
    
    // Add conversational markers occasionally
    if (Math.random() > 0.7 && !rewritten.match(/^(Well|Actually|Interestingly)/)) {
      const markers = ['Actually, ', 'Interestingly, ', ''];
      rewritten = markers[Math.floor(Math.random() * markers.length)] + rewritten;
    }

    const latency = Date.now() - startTime + baseLatency;
    
    return {
      rewritten,
      provider: 'sandbox',
      model: 'local-rules-based',
      latency_ms: latency,
      usage: {
        prompt_tokens: Math.ceil(text.length / 4),
        completion_tokens: Math.ceil(rewritten.length / 4),
        total_tokens: Math.ceil((text.length + rewritten.length) / 4)
      }
    };
  }

  /**
   * Smart Call with Automatic Fallback
   * Priority: Gemini (micro) → Cerebras → Huggingface
   * 
   * @param {string} prompt - The prompt to send
   * @param {object} options - Configuration options
   * @param {string} options.preferredProvider - 'gemini' (default for micro), 'cerebras', or 'huggingface'
   * @returns {object} Response with provider info
   */
  async callWithFallback(prompt, options = {}) {
    // Define provider priority based on context
    let providerOrder;
    
    if (options.preferredProvider === 'gemini' || options.agentType === 'micro') {
      // Micro agent: Gemini → Cerebras → Huggingface
      providerOrder = ['gemini', 'cerebras', 'huggingface'];
    } else if (options.preferredProvider === 'cerebras') {
      // Explicit Cerebras preference
      providerOrder = ['cerebras', 'gemini', 'huggingface'];
    } else {
      // Default: Gemini first
      providerOrder = ['gemini', 'cerebras', 'huggingface'];
    }

    const errors = [];

    // Try each provider in order
    for (const provider of providerOrder) {
      if (!this.providers[provider]?.available) {
        errors.push(`${provider}: Not available (missing API key)`);
        continue;
      }

      try {
        console.log(`🔄 Trying ${provider}...`);
        
        let result;
        switch (provider) {
          case 'gemini':
            result = await this.callGemini(prompt, options);
            break;
          case 'cerebras':
            result = await this.callCerebras(prompt, options);
            break;
          case 'huggingface':
            result = await this.callHuggingFace(prompt, options);
            break;
        }

        console.log(`✅ ${provider} succeeded`);
        return result;

      } catch (error) {
        console.warn(`⚠️ ${provider} failed:`, error.message);
        errors.push(`${provider}: ${error.message}`);
        
        // If this is the last provider, throw combined error
        if (provider === providerOrder[providerOrder.length - 1]) {
          throw new Error(
            `All LLM providers failed:\n${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
          );
        }
        
        // Otherwise, continue to next provider
        continue;
      }
    }

    // If we get here, no providers were available
    throw new Error('No LLM providers available. Please configure at least one API key.');
  }
}

module.exports = LLMClients;
