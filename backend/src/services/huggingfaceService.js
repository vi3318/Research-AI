const axios = require('axios');
const debug = require('debug')('researchai:huggingface');

class HuggingFaceService {
  constructor() {
    this.baseUrl = 'https://api-inference.huggingface.co/models';
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    
    if (!this.apiKey) {
      console.warn('HUGGINGFACE_API_KEY not set. Some features will be disabled.');
    }
  }

  /**
   * Generate embeddings using Hugging Face models
   */
  async generateEmbeddings(text, model = 'sentence-transformers/all-MiniLM-L6-v2') {
    if (!this.apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/${model}`,
        { inputs: text },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      debug('Error generating embeddings:', error.message);
      throw error;
    }
  }

  /**
   * Perform zero-shot classification
   */
  async zeroShotClassification(text, candidateLabels, model = 'facebook/bart-large-mnli') {
    if (!this.apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/${model}`,
        {
          inputs: text,
          parameters: { candidate_labels: candidateLabels }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      debug('Error in zero-shot classification:', error.message);
      throw error;
    }
  }

  /**
   * Generate text using language models
   */
  async generateText(prompt, model = 'gpt2', maxLength = 100) {
    if (!this.apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/${model}`,
        {
          inputs: prompt,
          parameters: {
            max_length: maxLength,
            do_sample: true,
            temperature: 0.7
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      debug('Error generating text:', error.message);
      throw error;
    }
  }

  /**
   * Perform question answering
   */
  async questionAnswering(question, context, model = 'deepset/roberta-base-squad2') {
    if (!this.apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/${model}`,
        {
          inputs: {
            question: question,
            context: context
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      debug('Error in question answering:', error.message);
      throw error;
    }
  }

  /**
   * Perform text summarization
   */
  async summarizeText(text, model = 'facebook/bart-large-cnn', maxLength = 130) {
    if (!this.apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/${model}`,
        {
          inputs: text,
          parameters: {
            max_length: maxLength,
            min_length: 30,
            do_sample: false
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      debug('Error in text summarization:', error.message);
      throw error;
    }
  }

  /**
   * Perform named entity recognition
   */
  async namedEntityRecognition(text, model = 'dbmdz/bert-large-cased-finetuned-conll03-english') {
    if (!this.apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/${model}`,
        { inputs: text },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      debug('Error in NER:', error.message);
      throw error;
    }
  }

  /**
   * Perform sentiment analysis
   */
  async sentimentAnalysis(text, model = 'cardiffnlp/twitter-roberta-base-sentiment-latest') {
    if (!this.apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/${model}`,
        { inputs: text },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      debug('Error in sentiment analysis:', error.message);
      throw error;
    }
  }

  /**
   * Enhanced research paper analysis using multiple models
   */
  async analyzeResearchPaper(paperContent, researchQuestion) {
    try {
      const results = await Promise.all([
        // Generate summary
        this.summarizeText(paperContent),
        // Perform question answering
        this.questionAnswering(researchQuestion, paperContent),
        // Extract key entities
        this.namedEntityRecognition(paperContent),
        // Analyze sentiment/tone
        this.sentimentAnalysis(paperContent)
      ]);

      return {
        summary: results[0],
        answer: results[1],
        entities: results[2],
        sentiment: results[3],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      debug('Error in research paper analysis:', error.message);
      throw error;
    }
  }

  /**
   * Generate research insights using zero-shot classification
   */
  async generateResearchInsights(paperAbstract, researchAreas) {
    try {
      const insights = await this.zeroShotClassification(
        paperAbstract,
        researchAreas
      );

      return {
        primaryArea: insights.labels[0],
        confidence: insights.scores[0],
        allAreas: insights.labels.map((label, index) => ({
          area: label,
          confidence: insights.scores[index]
        })),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      debug('Error generating research insights:', error.message);
      throw error;
    }
  }

  /**
   * Check if service is available
   */
  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    return {
      embeddings: [
        'sentence-transformers/all-MiniLM-L6-v2',
        'sentence-transformers/all-mpnet-base-v2',
        'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
      ],
      classification: [
        'facebook/bart-large-mnli',
        'microsoft/DialoGPT-medium'
      ],
      generation: [
        'gpt2',
        'microsoft/DialoGPT-medium',
        'EleutherAI/gpt-neo-125M'
      ],
      qa: [
        'deepset/roberta-base-squad2',
        'deepset/roberta-large-squad2'
      ],
      summarization: [
        'facebook/bart-large-cnn',
        'facebook/bart-large-xsum'
      ],
      ner: [
        'dbmdz/bert-large-cased-finetuned-conll03-english',
        'Jean-Baptiste/roberta-large-ner-english'
      ],
      sentiment: [
        'cardiffnlp/twitter-roberta-base-sentiment-latest',
        'nlptown/bert-base-multilingual-uncased-sentiment'
      ]
    };
  }
}

module.exports = new HuggingFaceService(); 