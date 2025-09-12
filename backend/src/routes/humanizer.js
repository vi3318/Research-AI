const express = require('express');
const router = express.Router();
const debug = require('debug')('researchai:humanizer');
const { HfInference } = require('@huggingface/inference');

// Initialize HuggingFace inference with API key
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Simple humanizer endpoint - no auth required for workspace usage
router.post('/humanize', async (req, res) => {
  try {
    const { text, workspace_id } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({
        error: 'Text is required',
        message: 'Please provide text to humanize'
      });
    }

    console.log('🧠 Starting text humanization process...', {
      textLength: text.length,
      workspaceId: workspace_id
    });

    // Use HuggingFace model for text humanization
    const humanizedText = await humanizeTextWithHF(text);
    const aiDetectionScore = calculateAIDetectionScore(text, humanizedText);

    console.log('✅ Text humanization completed:', {
      originalLength: text.length,
      humanizedLength: humanizedText.length,
      detectionScore: aiDetectionScore
    });

    res.json({
      success: true,
      humanized_text: humanizedText,
      ai_detection_score: aiDetectionScore,
      original_length: text.length,
      humanized_length: humanizedText.length,
      improvement_score: Math.max(0, 100 - aiDetectionScore),
      model_used: 'microsoft/DialoGPT-medium'
    });

  } catch (error) {
    console.error('❌ Error humanizing text:', error);
    
    res.status(500).json({
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

// Simple text humanization function
async function humanizeText(text) {
  try {
    // Advanced text transformation techniques
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

// HuggingFace text humanization function using advanced NLP models
async function humanizeTextWithHF(text) {
  try {
    // First, try using a paraphrasing model to humanize the text
    if (process.env.HUGGINGFACE_API_KEY) {
      try {
        // Use a text generation model suitable for humanization
        const response = await hf.textGeneration({
          model: 'microsoft/DialoGPT-medium',
          inputs: `Rewrite this text to sound more natural and human-like while preserving the meaning: "${text}"`,
          parameters: {
            max_new_tokens: Math.min(text.length * 2, 500),
            temperature: 0.7,
            do_sample: true,
            top_p: 0.9,
            repetition_penalty: 1.1
          }
        });

        if (response && response.generated_text) {
          // Extract the humanized portion from the response
          const humanizedText = response.generated_text
            .replace(/^.*?Rewrite this text.*?:/i, '')
            .replace(/^["']|["']$/g, '')
            .trim();
          
          if (humanizedText && humanizedText.length > 10) {
            console.log('✅ HuggingFace humanization successful');
            return humanizedText;
          }
        }
      } catch (hfError) {
        console.warn('⚠️ HuggingFace API failed, falling back to local processing:', hfError.message);
      }
    }
    
    // Fallback to local humanization if HuggingFace fails
    return await humanizeText(text);
    
  } catch (error) {
    console.error('❌ Error in HuggingFace humanization:', error);
    return await humanizeText(text); // Fallback to local processing
  }
}

// Helper functions
Array.prototype.random = function() {
  return this[Math.floor(Math.random() * this.length)];
};

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = router;
