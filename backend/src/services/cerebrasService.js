// Cerebras Cloud API Service - Fast AI Inference
class CerebrasService {
  constructor() {
    this.apiKey = process.env.CEREBRAS_API_KEY;
    this.baseUrl = 'https://api.cerebras.ai/v1';
    
    if (!this.apiKey) {
      console.warn('WARNING: Missing CEREBRAS_API_KEY environment variable');
    }
  }

  async generateText(prompt, options = {}) {
    try {
      const {
        model = 'llama3.1-8b',
        maxTokens = 4096,
        temperature = 0.7,
        streaming = false
      } = options;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature,
          stream: streaming
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Cerebras API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from Cerebras API');
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Cerebras API error:', error);
      throw new Error(`Failed to generate text with Cerebras: ${error.message}`);
    }
  }

  async generateContent(prompt, options = {}) {
    // Alias for generateText to maintain compatibility with existing code
    return this.generateText(prompt, options);
  }

  // Method to generate structured responses (useful for research analysis)
  async generateStructuredResponse(prompt, schema = null, options = {}) {
    try {
      let enhancedPrompt = prompt;
      
      if (schema) {
        enhancedPrompt += `\n\nPlease format your response as JSON following this schema:\n${JSON.stringify(schema, null, 2)}`;
      } else {
        enhancedPrompt += '\n\nPlease provide a well-structured, detailed response.';
      }

      const response = await this.generateText(enhancedPrompt, {
        ...options,
        temperature: 0.3 // Lower temperature for more structured outputs
      });

      // Try to parse as JSON if schema was provided
      if (schema) {
        try {
          return JSON.parse(response);
        } catch (parseError) {
          console.warn('Failed to parse Cerebras response as JSON, returning raw text');
          return response;
        }
      }

      return response;
    } catch (error) {
      console.error('Cerebras structured response error:', error);
      throw error;
    }
  }

  // Method for research-specific queries with optimized prompting
  async generateResearchResponse(prompt, options = {}) {
    const researchPrompt = `You are an expert research assistant with deep knowledge across multiple academic domains. 
Your task is to provide comprehensive, well-researched responses that are:
- Academically rigorous and evidence-based
- Clear and well-structured
- Practical and actionable when appropriate
- Current with recent developments in the field

Query: ${prompt}

Please provide a detailed, professional response:`;

    return this.generateText(researchPrompt, {
      maxTokens: 6000,
      temperature: 0.6,
      ...options
    });
  }

  // Method for paper analysis and Q&A
  async generatePaperAnalysis(question, paperContext = [], options = {}) {
    let contextText = '';
    
    if (paperContext.length > 0) {
      contextText = '\n\nContext from research papers:\n';
      paperContext.forEach((paper, index) => {
        contextText += `\n${index + 1}. Title: ${paper.title}\n`;
        if (paper.authors) {
          contextText += `   Authors: ${Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors}\n`;
        }
        if (paper.abstract) {
          contextText += `   Abstract: ${paper.abstract.substring(0, 500)}...\n`;
        }
        if (paper.content) {
          contextText += `   Content: ${paper.content.substring(0, 1000)}...\n`;
        }
      });
    }

    const analysisPrompt = `You are an expert research analyst. Based on the provided research papers, please answer the following question with detailed analysis and insights.

Question: ${question}${contextText}

Please provide a comprehensive analysis that:
1. Directly answers the question
2. References specific papers when relevant
3. Identifies key findings and patterns
4. Highlights any contradictions or gaps
5. Suggests areas for further research

Response:`;

    return this.generateText(analysisPrompt, {
      maxTokens: 8000,
      temperature: 0.5,
      ...options
    });
  }

  // Health check method
  async healthCheck() {
    try {
      const response = await this.generateText('Hello', { maxTokens: 10 });
      return { status: 'healthy', response: response.substring(0, 50) };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}

module.exports = new CerebrasService();
