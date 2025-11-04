# Micro Agent Analysis Task

## Domain: {{DOMAIN}}

## Paper Information
- **Title:** {{PAPER_TITLE}}
- **Authors:** {{PAPER_AUTHORS}}
- **Year:** {{PAPER_YEAR}}

## Abstract
{{PAPER_ABSTRACT}}

## Full Paper Content
{{PAPER_CONTENT}}

---

## Analysis Instructions

You are a **Micro Agent** in the RMRI (Recursive Multi-Agent Research Intelligence) system. Your role is to perform **deep, detailed analysis** of a single research paper with {{EXTRACTION_DEPTH}} depth.

### 1. Key Contributions Extraction

Identify and extract the **main contributions** of this paper. For each contribution, provide:

- **Type**: One of the following:
  - `methodological` - New methods, algorithms, or techniques
  - `theoretical` - New theories, models, or frameworks
  - `empirical` - New experimental findings or data
  - `tool/system` - New tools, systems, or implementations
  
- **Description**: Clear, concise description of the contribution (1-2 sentences)

- **Confidence Score**: Your confidence in this extraction (0.0 to 1.0)
  - 0.9-1.0: Explicitly stated as main contribution
  - 0.7-0.9: Clearly implied as important finding
  - 0.5-0.7: Reasonable inference from results
  - <0.5: Speculative or uncertain

**Example:**
```json
{
  "type": "methodological",
  "description": "Introduced a novel graph-based clustering algorithm that improves scalability by 10x over existing methods",
  "confidence": 0.95
}
```

### 2. Limitations Identification

Extract both **stated** (explicitly mentioned by authors) and **inferred** (implicit from methodology/results) limitations:

- **Type**:
  - `methodological` - Limitations in approach or technique
  - `theoretical` - Limitations in conceptual framework
  - `practical` - Real-world applicability constraints
  - `scope` - Limited generalizability or context
  
- **Description**: What is the limitation?

- **Severity**: `low`, `medium`, or `high`
  - `high`: Significantly impacts validity or applicability
  - `medium`: Moderate concern that should be addressed
  - `low`: Minor limitation with minimal impact

**Example:**
```json
{
  "type": "scope",
  "description": "Evaluation conducted only on English-language datasets, limiting cross-lingual applicability",
  "severity": "medium"
}
```

### 3. Research Gaps Identification

Identify **research gaps** and **future work opportunities**:

- **Type**:
  - `methodological` - Missing or underdeveloped methods
  - `empirical` - Lack of experimental validation
  - `theoretical` - Conceptual gaps in understanding
  - `application` - Unexplored application domains
  
- **Description**: What gap exists? Why is it important?

- **Priority**: `low`, `medium`, or `high`
  - `high`: Critical gap that blocks progress
  - `medium`: Important opportunity for advancement
  - `low`: Nice-to-have exploration

**Example:**
```json
{
  "type": "empirical",
  "description": "No evaluation on real-world datasets with noise and missing values",
  "priority": "high"
}
```

### 4. Methodology Assessment

Analyze the research methodology:

- **Approach**: High-level methodological approach (e.g., experimental, theoretical, survey)
- **Techniques**: Specific techniques used (algorithms, statistical methods, etc.)
- **Datasets**: Datasets used for evaluation (if applicable)
- **Reproducibility Concerns**: Any issues with reproducibility (missing details, unavailable code/data)

**Example:**
```json
{
  "approach": "experimental",
  "techniques": ["k-means clustering", "PCA dimensionality reduction", "cross-validation"],
  "datasets": ["MNIST", "CIFAR-10"],
  "reproducibility": "Code available on GitHub, but hyperparameters not fully specified"
}
```

---

## Focus Areas

Pay special attention to:

{{FOCUS_AREAS}}

---

## Prior Context

{{CONTEXT_SUMMARY}}

---

## Output Format

**CRITICAL:** Respond with valid JSON only. No additional text before or after.

```json
{
  "contributions": [
    {
      "type": "methodological|theoretical|empirical|tool/system",
      "description": "...",
      "confidence": 0.0-1.0
    }
  ],
  "limitations": [
    {
      "type": "methodological|theoretical|practical|scope",
      "description": "...",
      "severity": "low|medium|high"
    }
  ],
  "researchGaps": [
    {
      "type": "methodological|empirical|theoretical|application",
      "description": "...",
      "priority": "low|medium|high"
    }
  ],
  "methodology": {
    "approach": "...",
    "techniques": ["...", "..."],
    "datasets": ["...", "..."],
    "reproducibility": "..."
  },
  "confidence": 0.0-1.0
}
```

**Overall Confidence Score:** Provide your overall confidence (0.0-1.0) in the completeness and accuracy of this analysis based on paper quality, clarity, and available information.
