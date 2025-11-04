# LLM Services - Usage Guide & Examples

## Overview

This document provides complete examples of using the three new LLM services:
- `llmClients.js` - Multi-provider LLM integration
- `confidence.js` - Confidence calculation
- `promptCascader.js` - Dynamic prompt generation

---

## 1. llmClients.js - LLM Provider Integration

### Single Provider Calls

#### Cerebras (Primary - Ultra Fast)

```javascript
const llmClients = require('./services/llmClients');

const result = await llmClients.callCerebras(
  'Analyze the key contributions of this research paper: ...',
  {
    model: 'llama3.1-8b', // or 'llama3.1-70b' for better quality
    temperature: 0.7,
    maxTokens: 2000,
    systemPrompt: 'You are an expert research analyst.'
  }
);

console.log(result);
```

**Response Structure:**
```json
{
  "provider": "cerebras",
  "model": "llama3.1-8b",
  "output": "This paper makes three key contributions: 1) A novel graph attention mechanism...",
  "confidence": 0.87,
  "metadata": {
    "tokensUsed": 1245,
    "promptTokens": 523,
    "completionTokens": 722,
    "latency": "1.2s"
  }
}
```

#### Hugging Face (Fallback)

```javascript
const result = await llmClients.callHuggingFace(
  'What are the research gaps in quantum computing?',
  {
    model: 'meta-llama/Meta-Llama-3-8B-Instruct',
    temperature: 0.6,
    maxTokens: 1500
  }
);
```

#### Gemini (Secondary)

```javascript
const result = await llmClients.callGemini(
  'Summarize the methodology of this paper: ...',
  {
    model: 'gemini-1.5-flash', // or 'gemini-1.5-pro'
    temperature: 0.5,
    maxTokens: 2000
  }
);
```

### Ensemble Call - Multiple Providers

```javascript
const ensembleResult = await llmClients.callEnsemble(
  'Identify research gaps in the following papers: ...',
  {
    providers: ['cerebras', 'gemini', 'huggingface'], // Use all available
    aggregation: 'consensus', // or 'best' or 'all'
    minProviders: 2,
    temperature: 0.7,
    maxTokens: 3000
  }
);
```

**Ensemble Response Structure:**
```json
{
  "success": true,
  "output": "Based on analysis across providers, the key research gaps are: 1) Lack of scalability...",
  "confidence": 0.82,
  "aggregationMethod": "consensus",
  "providers": [
    {
      "provider": "cerebras",
      "model": "llama3.1-8b",
      "confidence": 0.85,
      "output": "The main gaps identified are...",
      "metadata": {
        "tokensUsed": 1200,
        "latency": "1.5s"
      }
    },
    {
      "provider": "gemini",
      "model": "gemini-1.5-flash",
      "confidence": 0.78,
      "output": "Key research gaps include...",
      "metadata": {
        "tokensUsed": 1350,
        "latency": "2.1s"
      }
    },
    {
      "provider": "huggingface",
      "model": "meta-llama/Meta-Llama-3-8B-Instruct",
      "confidence": 0.83,
      "output": "Major gaps in this area are...",
      "metadata": {
        "tokensUsed": 1100
      }
    }
  ],
  "metrics": {
    "providersUsed": 3,
    "providersRequested": 3,
    "averageSimilarity": 0.71,
    "totalTokensUsed": 3650
  },
  "timestamp": "2025-11-02T10:30:45.123Z"
}
```

### Automatic Fallback

```javascript
// Tries providers in order: cerebras → gemini → huggingface
const result = await llmClients.callWithFallback(
  'Analyze this research paper...',
  {
    preferredOrder: ['cerebras', 'gemini', 'huggingface'],
    temperature: 0.7
  }
);
```

### Health Check

```javascript
const health = llmClients.getHealthStatus();
console.log(health);
```

**Response:**
```json
{
  "providers": [
    {
      "name": "cerebras",
      "available": true,
      "lastSuccess": "2025-11-02T10:30:00.000Z",
      "failureCount": 0,
      "status": "healthy"
    },
    {
      "name": "gemini",
      "available": true,
      "lastSuccess": "2025-11-02T10:29:00.000Z",
      "failureCount": 0,
      "status": "healthy"
    },
    {
      "name": "huggingface",
      "available": true,
      "lastSuccess": null,
      "failureCount": 2,
      "status": "degraded"
    }
  ]
}
```

---

## 2. confidence.js - Confidence Calculation

### Basic Confidence Calculation

```javascript
const confidenceCalculator = require('./services/confidence');

const confidence = confidenceCalculator.calculateConfidence({
  providerConfidence: 0.85,      // From LLM provider
  similarityAgreement: 0.72,      // Agreement between providers
  evidenceCount: 15,              // Number of supporting papers
  output: {                       // Generated output to analyze
    contributions: [...],
    researchGaps: [...]
  },
  maxEvidence: 20                 // Expected max papers
});

console.log(confidence);
```

**Response:**
```json
{
  "finalConfidence": 0.79,
  "confidenceLevel": "high",
  "breakdown": {
    "providerConfidence": {
      "score": 0.85,
      "weight": 0.35,
      "contribution": 0.2975
    },
    "similarityAgreement": {
      "score": 0.78,
      "weight": 0.30,
      "contribution": 0.234
    },
    "evidenceCount": {
      "score": 0.82,
      "weight": 0.20,
      "contribution": 0.164,
      "rawCount": 15
    },
    "outputQuality": {
      "score": 0.75,
      "weight": 0.15,
      "contribution": 0.1125
    }
  },
  "metadata": {
    "isReliable": true,
    "needsVerification": false,
    "calculatedAt": "2025-11-02T10:30:45.123Z"
  }
}
```

### Ensemble Confidence

```javascript
// Calculate confidence from ensemble LLM result
const ensembleConfidence = confidenceCalculator.calculateEnsembleConfidence(
  ensembleResult  // Output from llmClients.callEnsemble()
);
```

### Agent-Specific Confidence

#### Micro Agent
```javascript
const microConfidence = confidenceCalculator.calculateMicroAgentConfidence({
  providerConfidence: 0.87,
  extractedSections: ['abstract', 'methodology', 'results', 'conclusion'],
  contributions: [
    { type: 'methodological', description: '...' },
    { type: 'empirical', description: '...' }
  ],
  limitations: [
    { type: 'scope', severity: 'medium' }
  ],
  researchGaps: [
    { type: 'empirical', priority: 'high' },
    { type: 'theoretical', priority: 'medium' }
  ]
});
```

#### Meso Agent
```javascript
const mesoConfidence = confidenceCalculator.calculateMesoAgentConfidence({
  providerConfidence: 0.80,
  clusters: [
    { theme: 'GNN', cohesion: 0.85, papers: [...] },
    { theme: 'Transformers', cohesion: 0.78, papers: [...] }
  ],
  patterns: [
    { type: 'methodological_overlap', confidence: 0.9 }
  ],
  thematicGaps: [...]
});
```

#### Meta Agent
```javascript
const metaConfidence = confidenceCalculator.calculateMetaAgentConfidence(
  metaOutput,           // Current meta output
  previousMetaOutput    // Previous iteration (for convergence)
);
```

### Aggregate Multiple Confidences

```javascript
const microConfidences = [0.85, 0.78, 0.92, 0.81, 0.88];

const aggregated = confidenceCalculator.aggregateConfidences(
  microConfidences,
  'weighted_average'  // or 'min', 'max', 'median'
);
```

**Response:**
```json
{
  "finalConfidence": 0.84,
  "confidenceLevel": "high",
  "method": "weighted_average",
  "itemCount": 5,
  "range": {
    "min": 0.78,
    "max": 0.92,
    "spread": 0.14
  }
}
```

---

## 3. promptCascader.js - Dynamic Prompt Generation

### Micro Agent Prompt

```javascript
const promptCascader = require('./services/promptCascader');

const microPrompt = await promptCascader.buildMicroPrompt({
  paper: {
    title: 'Graph Attention Networks',
    authors: ['Veličković, P.', 'Cucurull, G.', 'Casanova, A.'],
    year: 2018,
    abstract: 'We present graph attention networks (GATs)...',
    fullText: '...full paper content...'
  },
  domain: 'machine_learning',
  focusAreas: [
    'Novel architectures',
    'Attention mechanisms',
    'Graph learning'
  ],
  contextSummary: 'Previous papers focused on standard GCNs. GATs introduce attention.',
  depth: 'detailed'
});

// Use prompt with LLM
const result = await llmClients.callCerebras(microPrompt);
```

### Meso Agent Prompt

```javascript
const mesoPrompt = await promptCascader.buildMesoPrompt({
  microOutputs: [
    {
      title: 'Paper 1',
      contributions: [...],
      researchGaps: [...],
      confidence: 0.85
    },
    {
      title: 'Paper 2',
      contributions: [...],
      researchGaps: [...],
      confidence: 0.78
    }
    // ... more papers
  ],
  domain: 'machine_learning',
  clusteringStrategy: 'thematic',
  contextSummary: 'Iteration 1: Initial clustering',
  minClusterSize: 2,
  maxClusters: 5
});

const result = await llmClients.callEnsemble(mesoPrompt, {
  providers: ['cerebras', 'gemini']
});
```

### Meta Agent Prompt

```javascript
const metaPrompt = await promptCascader.buildMetaPrompt({
  mesoOutput: {
    clusters: [
      {
        theme: { label: 'GNNs', keywords: [...] },
        papers: [...],
        keyContributions: [...],
        identifiedGaps: [...]
      }
      // ... more clusters
    ],
    patterns: [...]
  },
  domain: 'machine_learning',
  iteration: 2,
  previousMetaOutput: {
    rankedGaps: [...]  // From iteration 1
  },
  contextSummary: 'Iteration 2: Refining gap ranking',
  convergenceThreshold: 0.7,
  maxGapsToRank: 20
});

const result = await llmClients.callGemini(metaPrompt);
```

### Custom Template Prompt

```javascript
// Create custom template first
// File: backend/prompts/custom_template.md
// Content: "Analyze {{TOPIC}} in domain {{DOMAIN}}"

const customPrompt = promptCascader.buildCustomPrompt(
  'custom_template',
  {
    TOPIC: 'neural architecture search',
    DOMAIN: 'deep_learning'
  }
);
```

### Context Summarization

```javascript
const longContext = {
  papers: [...],  // 100 papers
  clusters: [...], // 10 clusters
  gaps: [...]     // 50 gaps
};

const summary = promptCascader.summarizeContext(
  longContext,
  500  // Max 500 characters
);

console.log(summary);
// Output: "Papers focus on GNNs (40%), Transformers (35%), CNNs (25%). 
//          Top gaps: scalability, interpretability... [Additional context omitted]"
```

---

## Complete RMRI Workflow Example

```javascript
const llmClients = require('./services/llmClients');
const confidenceCalculator = require('./services/confidence');
const promptCascader = require('./services/promptCascader');

// Initialize
await promptCascader.initialize();

// Step 1: Micro Agent Processing (for each paper)
const papers = [...];  // Array of papers
const microResults = [];

for (const paper of papers) {
  // Generate prompt
  const microPrompt = await promptCascader.buildMicroPrompt({
    paper,
    domain: 'machine_learning',
    focusAreas: ['contributions', 'gaps', 'methodology']
  });
  
  // Call LLM with ensemble
  const llmResult = await llmClients.callEnsemble(microPrompt, {
    providers: ['cerebras', 'gemini'],
    aggregation: 'consensus'
  });
  
  // Calculate confidence
  const confidence = confidenceCalculator.calculateEnsembleConfidence(llmResult);
  
  // Parse and store
  const microOutput = JSON.parse(llmResult.output);
  microOutput.confidence = confidence.finalConfidence;
  microResults.push(microOutput);
}

// Step 2: Meso Agent Clustering
const mesoPrompt = await promptCascader.buildMesoPrompt({
  microOutputs: microResults,
  domain: 'machine_learning',
  clusteringStrategy: 'thematic'
});

const mesoLLMResult = await llmClients.callGemini(mesoPrompt);
const mesoOutput = JSON.parse(mesoLLMResult.output);
const mesoConfidence = confidenceCalculator.calculateMesoAgentConfidence(mesoOutput);

// Step 3: Meta Agent Synthesis
const metaPrompt = await promptCascader.buildMetaPrompt({
  mesoOutput,
  domain: 'machine_learning',
  iteration: 1,
  previousMetaOutput: null
});

const metaLLMResult = await llmClients.callEnsemble(metaPrompt, {
  providers: ['cerebras', 'gemini'],
  aggregation: 'best'
});

const metaOutput = JSON.parse(metaLLMResult.output);
const metaConfidence = confidenceCalculator.calculateMetaAgentConfidence(metaOutput);

console.log('Top Research Gaps:', metaOutput.rankedGaps.slice(0, 5));
console.log('Meta Confidence:', metaConfidence.finalConfidence);
console.log('Convergence:', metaOutput.convergence);
```

---

## Environment Configuration

Add to `.env`:

```env
# Cerebras API (Primary)
CEREBRAS_API_KEY=your_cerebras_key_here

# Hugging Face API (Fallback)
HUGGINGFACE_API_KEY=your_hf_key_here

# Google Gemini API (Secondary)
GEMINI_API_KEY=your_gemini_key_here
```

---

## Integration with Workers

### In microAgentWorker.js

```javascript
const llmClients = require('../services/llmClients');
const promptCascader = require('../services/promptCascader');
const confidenceCalculator = require('../services/confidence');

// Inside processJob function
const prompt = await promptCascader.buildMicroPrompt({
  paper: job.data.paper,
  domain: job.data.domain || 'general'
});

const llmResult = await llmClients.callWithFallback(prompt, {
  preferredOrder: ['cerebras', 'gemini'],
  temperature: 0.7
});

const output = JSON.parse(llmResult.output);
const confidence = confidenceCalculator.calculateMicroAgentConfidence({
  ...output,
  providerConfidence: llmResult.confidence
});

return { ...output, confidence: confidence.finalConfidence };
```

---

## Error Handling

```javascript
try {
  const result = await llmClients.callEnsemble(prompt, {
    providers: ['cerebras', 'gemini', 'huggingface'],
    minProviders: 2
  });
} catch (error) {
  if (error.message.includes('No LLM providers available')) {
    console.error('All providers are down. Check API keys.');
  } else if (error.message.includes('Only')) {
    console.error('Not enough providers responded:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

**Status:** ✅ All services implemented and ready for use!
