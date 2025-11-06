/**
 * Simple Humanizer Service
 * Direct Cerebras API call for text humanization
 * No complex error handling, just straightforward API call
 */

const axios = require('axios');

class SimpleHumanizer {
  constructor() {
    this.cerebrasApiKey = process.env.CEREBRAS_API_KEY;
    this.cerebrasBaseUrl = 'https://api.cerebras.ai/v1';
    this.model = 'llama-3.3-70b';
  }

  /**
   * Humanize text using Cerebras Llama 3.1 70B
   * @param {string} text - Text to humanize
   * @returns {Promise<Object>} - { humanized_text, provider, model, latency_ms }
   */
  async humanize(text) {
    console.log('🧠 [SimpleHumanizer] Starting humanization...');
    console.log('📝 Input text length:', text.length);
    
    const startTime = Date.now();

    // Validate API key
    if (!this.cerebrasApiKey) {
      throw new Error('CEREBRAS_API_KEY not configured in environment variables');
    }

    // Create the prompt
    const prompt = `You are an expert at rewriting AI-generated text to sound natural and human-written.

Rewrite the text below following these rules:
Use natural language and human-like phrasing 
1. Remove AI-like phrases: "Furthermore", "Additionally", "In conclusion", "It is important to note", "Moreover"
2. Use simple, direct language: "use" instead of "utilize", "help" instead of "facilitate"
3. Vary sentence length and structure for natural flow
4. Add casual transitions: "but", "so", "and", "because", "plus"
5. Keep all technical information and facts accurate
6. Maintain similar length to original (±10%)
7. Do NOT add explanations or extra content
8. Use nlp techniques that most humanizers use
8. Return ONLY the rewritten text

Text to humanize:
${text}`;

    try {
      console.log('📡 [SimpleHumanizer] Calling Cerebras API...');
      console.log('🔑 API Key configured:', this.cerebrasApiKey ? 'Yes' : 'No');
      console.log('🌐 API URL:', `${this.cerebrasBaseUrl}/chat/completions`);
      console.log('🤖 Model:', this.model);

      const response = await axios.post(
        `${this.cerebrasBaseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at rewriting AI-generated academic text to sound natural and human-written while preserving accuracy.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 3000,
          temperature: 0.8,
          top_p: 0.9,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.cerebrasApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 seconds
        }
      );

      const humanizedText = response.data.choices[0].message.content;
      const usage = response.data.usage || {};
      const latency = Date.now() - startTime;

      console.log('✅ [SimpleHumanizer] Success!');
      console.log('📊 Stats:', {
        originalLength: text.length,
        humanizedLength: humanizedText.length,
        tokensUsed: usage.total_tokens,
        latency: `${latency}ms`
      });

      return {
        humanized_text: humanizedText,
        original_text: text,
        provider: 'cerebras',
        model: this.model,
        latency_ms: latency,
        usage: {
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0
        }
      };

    } catch (error) {
      console.error('❌ [SimpleHumanizer] Error:', error.message);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      
      throw new Error(`Humanization failed: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new SimpleHumanizer();
