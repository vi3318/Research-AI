const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');
const { rateLimitHumanize } = require('../middleware/rateLimit');
const { humanizerService } = require('../services/humanizer');
const router = express.Router();
const debug = require('debug')('researchai:humanizer');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Enhanced humanizer endpoint with JWT auth, rate limiting, and logging
router.post('/humanize', requireAuth, rateLimitHumanize, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user.id;
    const { text, workspace_id, provider } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
        message: 'Please provide text to humanize'
      });
    }

    debug('Starting text humanization...', {
      userId,
      textLength: text.length,
      workspaceId: workspace_id,
      provider: provider || 'auto'
    });

    // Humanize using service layer
    const result = await humanizerService.humanize(text, {
      provider,
      skipPreProcess: req.body.skipPreProcess,
      skipPostProcess: req.body.skipPostProcess
    });

    const processingTime = Date.now() - startTime;

    // Log to database
    try {
      await supabase.from('humanizer_logs').insert({
        user_id: userId,
        workspace_id: workspace_id || null,
        input_text: text,
        output_text: result.rewritten,
        provider: result.provider,
        model: result.model,
        input_tokens: result.usage.prompt_tokens,
        output_tokens: result.usage.completion_tokens,
        processing_time_ms: processingTime,
        success: true,
        error_message: null
      });
    } catch (logError) {
      debug('Failed to log humanizer request:', logError.message);
      // Don't fail the request if logging fails
    }

    debug('Text humanization completed:', {
      provider: result.provider,
      qualityScore: result.quality_score,
      latency: processingTime
    });

    res.json({
      success: true,
      humanized_text: result.rewritten,
      original_text: result.original,
      provider: result.provider,
      model: result.model,
      quality_score: result.quality_score,
      latency_ms: processingTime,
      llm_latency_ms: result.llm_latency_ms,
      usage: result.usage,
      changes: result.changes
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ [Humanizer] Error:', error);
    console.error('Stack trace:', error.stack);
    debug('Error humanizing text:', error.message);
    
    // Log error to database
    try {
      await supabase.from('humanizer_logs').insert({
        user_id: req.user.id,
        workspace_id: req.body.workspace_id || null,
        input_text: req.body.text || '',
        output_text: '',
        provider: req.body.provider || 'auto',
        processing_time_ms: processingTime,
        success: false,
        error_message: error.message
      });
    } catch (logError) {
      debug('Failed to log error:', logError.message);
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to humanize text',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'humanizer',
    timestamp: new Date().toISOString()
  });
});

// Simple text humanization function with provider support
async function humanizeText(text, provider = 'cerebras') {
  try {
    // If Cerebras API key available, use it
    if (provider === 'cerebras' && process.env.CEREBRAS_API_KEY) {
      return await humanizeWithCerebras(text);
    }
    
    // If HuggingFace API key available, use it
    if (provider === 'huggingface' && process.env.HF_API_KEY) {
      return await humanizeWithHuggingFace(text);
    }
    
    // Fallback to rule-based transformation
    console.log('⚠️ Using fallback rule-based humanization (no API keys configured)');
    let humanized = text;
    
    // 1. Vary sentence structure
    humanized = varySentenceStructure(humanized);
    
    // 2. Replace formal language with more natural alternatives
    humanized = replaceFormalLanguage(humanized);
    
    // 3. Add transitional phrases and connectors
    humanized = addTransitions(humanized);
    
    // 4. Introduce slight variations in word choice
    humanized = varyWordChoice(humanized);
    
    // 5. Adjust tone to be more conversational
    humanized = makeConversational(humanized);
    
    return humanized;
    
  } catch (error) {
    console.error('Error in text humanization:', error);
    return text; // Return original if processing fails
  }
}

// Cerebras API humanization
async function humanizeWithCerebras(text) {
  try {
    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3.1-8b',
        messages: [{
          role: 'user',
          content: `Rewrite the following text to make it sound more natural and human-written while preserving all key information:\n\n${text}`
        }],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    if (!response.ok) {
      throw new Error(`Cerebras API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Cerebras API error:', error);
    throw error;
  }
}

// HuggingFace API humanization
async function humanizeWithHuggingFace(text) {
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: text })
      }
    );
    
    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data[0]?.summary_text || text;
  } catch (error) {
    console.error('HuggingFace API error:', error);
    throw error;
  }
}

// Rule-based text humanization functions below...

// Vary sentence structure to make it more human-like
function varySentenceStructure(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  return sentences.map(sentence => {
    const trimmed = sentence.trim();
    if (trimmed.length === 0) return trimmed;
    
    // Randomly restructure some sentences
    if (Math.random() > 0.7) {
      // Add introductory phrases
      const intros = ['Interestingly,', 'Notably,', 'It should be noted that', 'Furthermore,', 'Additionally,', 'Moreover,'];
      if (!trimmed.match(/^(However|Moreover|Furthermore|Additionally|Interestingly|Notably)/)) {
        return `${intros[Math.floor(Math.random() * intros.length)]} ${trimmed.toLowerCase()}`;
      }
    }
    
    return trimmed;
  }).join('. ') + '.';
}

// Replace formal/robotic language with more natural alternatives
function replaceFormalLanguage(text) {
  const replacements = [
    { formal: /\bfurthermore\b/gi, natural: ['also', 'in addition', 'what\'s more', 'beyond that'].random() },
    { formal: /\butilize\b/gi, natural: 'use' },
    { formal: /\bdemonstrate\b/gi, natural: ['show', 'prove', 'illustrate', 'reveal'].random() },
    { formal: /\bfacilitate\b/gi, natural: ['help', 'make easier', 'enable', 'support'].random() },
    { formal: /\bimplementation\b/gi, natural: ['putting into practice', 'execution', 'application'].random() },
    { formal: /\bmethodology\b/gi, natural: ['method', 'approach', 'way of doing things'].random() },
    { formal: /\bin order to\b/gi, natural: 'to' },
    { formal: /\bdue to the fact that\b/gi, natural: ['because', 'since', 'as'].random() },
    { formal: /\bconsequently\b/gi, natural: ['so', 'therefore', 'as a result', 'this means'].random() },
    { formal: /\bin conclusion\b/gi, natural: ['to sum up', 'overall', 'in the end', 'ultimately'].random() }
  ];
  
  let result = text;
  replacements.forEach(({ formal, natural }) => {
    if (typeof natural === 'string') {
      result = result.replace(formal, natural);
    }
  });
  
  return result;
}

// Add transitional phrases to improve flow
function addTransitions(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  if (sentences.length < 2) return text;
  
  const transitions = {
    contrast: ['However,', 'On the other hand,', 'In contrast,', 'Nevertheless,'],
    addition: ['Furthermore,', 'Additionally,', 'What\'s more,', 'Also,'],
    explanation: ['In other words,', 'That is to say,', 'Specifically,', 'For instance,'],
    conclusion: ['Therefore,', 'As a result,', 'Consequently,', 'Thus,']
  };
  
  return sentences.map((sentence, index) => {
    if (index === 0) return sentence.trim();
    
    // Randomly add transitions (30% chance)
    if (Math.random() > 0.7) {
      const transitionTypes = Object.keys(transitions);
      const randomType = transitionTypes[Math.floor(Math.random() * transitionTypes.length)];
      const randomTransition = transitions[randomType][Math.floor(Math.random() * transitions[randomType].length)];
      
      return `${randomTransition} ${sentence.trim().toLowerCase()}`;
    }
    
    return sentence.trim();
  }).join('. ') + '.';
}

// Vary word choice to avoid repetition
function varyWordChoice(text) {
  const synonyms = {
    'important': ['crucial', 'significant', 'vital', 'key', 'essential'],
    'different': ['various', 'diverse', 'distinct', 'separate', 'unique'],
    'increase': ['rise', 'grow', 'expand', 'boost', 'enhance'],
    'decrease': ['reduce', 'lower', 'drop', 'diminish', 'decline'],
    'improve': ['enhance', 'better', 'upgrade', 'refine', 'advance'],
    'analysis': ['examination', 'study', 'investigation', 'review', 'assessment'],
    'research': ['study', 'investigation', 'inquiry', 'exploration', 'examination'],
    'results': ['findings', 'outcomes', 'conclusions', 'data', 'evidence']
  };
  
  let result = text;
  
  Object.entries(synonyms).forEach(([word, alternatives]) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = [...result.matchAll(regex)];
    
    // Replace some instances with synonyms
    matches.forEach((match, index) => {
      if (Math.random() > 0.6) { // 40% chance to replace
        const synonym = alternatives[Math.floor(Math.random() * alternatives.length)];
        result = result.replace(match[0], match[0] === match[0].toLowerCase() ? synonym : capitalize(synonym));
      }
    });
  });
  
  return result;
}

// Make text more conversational
function makeConversational(text) {
  let result = text;
  
  // Add occasional contractions
  result = result.replace(/\bcannot\b/gi, 'can\'t');
  result = result.replace(/\bdo not\b/gi, 'don\'t');
  result = result.replace(/\bwill not\b/gi, 'won\'t');
  result = result.replace(/\bit is\b/gi, 'it\'s');
  result = result.replace(/\bthat is\b/gi, 'that\'s');
  
  // Add occasional rhetorical questions (sparingly)
  const sentences = result.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 3 && Math.random() > 0.8) {
    const questionStarters = ['What does this mean?', 'Why is this important?', 'How does this work?'];
    const randomQuestion = questionStarters[Math.floor(Math.random() * questionStarters.length)];
    const insertIndex = Math.floor(sentences.length / 2);
    sentences.splice(insertIndex, 0, randomQuestion);
  }
  
  return sentences.join('. ') + '.';
}

// Calculate AI detection score (simplified heuristic)
function calculateAIDetectionScore(originalText, humanizedText) {
  let score = 80; // Start with high AI detection score
  
  // Factors that reduce AI detection score
  const contractions = (humanizedText.match(/[''](?:t|s|re|ve|ll|d)\b/g) || []).length;
  const transitions = (humanizedText.match(/\b(however|furthermore|additionally|moreover|in contrast|on the other hand)\b/gi) || []).length;
  const questions = (humanizedText.match(/\?/g) || []).length;
  const personalPronouns = (humanizedText.match(/\b(I|we|you|they)\b/gi) || []).length;
  
  // Reduce score based on human-like features
  score -= contractions * 3;
  score -= transitions * 2;
  score -= questions * 5;
  score -= personalPronouns * 1;
  
  // Text variation factor
  const lengthDifference = Math.abs(originalText.length - humanizedText.length);
  const variationScore = Math.min(lengthDifference / originalText.length * 100, 20);
  score -= variationScore;
  
  return Math.max(15, Math.min(95, score)); // Keep between 15-95
}

// Helper functions
Array.prototype.random = function() {
  return this[Math.floor(Math.random() * this.length)];
};

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = router;
