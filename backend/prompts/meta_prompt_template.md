# Meta Agent Synthesis Task

## Domain: {{DOMAIN}}
## Iteration: {{ITERATION}}

## Cluster Analysis Summary

- **Total Clusters:** {{TOTAL_CLUSTERS}}
- **Total Cross-Cluster Patterns:** {{TOTAL_PATTERNS}}

### Clusters Overview

{{CLUSTER_SUMMARIES}}

---

## Previous Iteration Context

{{PREVIOUS_ITERATION_CONTEXT}}

---

## Instructions

You are a **Meta Agent** in the RMRI system. Your role is to perform **cross-domain synthesis** and **research gap ranking** at the highest level of abstraction.

### 1. Cross-Domain Pattern Recognition

Identify high-level patterns that emerge across **all clusters**:

- **Type**:
  - `methodological_trend` - Widespread adoption of certain methods
  - `theoretical_convergence` - Multiple fields converging on similar concepts
  - `application_synergy` - Complementary application domains
  - `infrastructure_need` - Common infrastructure or resource requirements
  
- **Description**: What is the pattern? Why is it significant?
- **Clusters Involved**: Which clusters exhibit this pattern?
- **Confidence**: Your confidence in this pattern (0.0-1.0)

**Example:**
```json
{
  "type": "methodological_trend",
  "description": "Attention mechanisms are being adopted across NLP, Computer Vision, and Graph Learning, suggesting a universal importance of selective focus in neural architectures",
  "clustersInvolved": ["NLP Transformers", "Vision Transformers", "Graph Attention Networks"],
  "confidence": 0.95
}
```

### 2. Research Gap Ranking

Rank up to **{{MAX_GAPS_TO_RANK}} research gaps** using multi-criteria scoring:

For each gap, assign scores (0.0-1.0) for:

1. **Importance (35% weight)**: How critical is addressing this gap for field advancement?
   - 0.9-1.0: Fundamental blocker preventing major progress
   - 0.7-0.9: Significant limitation affecting multiple research areas
   - 0.5-0.7: Important but not critical
   - <0.5: Minor or niche concern

2. **Novelty (25% weight)**: How unexplored is this gap?
   - 0.9-1.0: Completely unexplored, no existing work
   - 0.7-0.9: Limited exploration, major opportunities remain
   - 0.5-0.7: Moderate existing work, refinement needed
   - <0.5: Well-studied area

3. **Feasibility (20% weight)**: How achievable is addressing this gap?
   - 0.9-1.0: Can be addressed with current technology/methods
   - 0.7-0.9: Requires modest innovation or resources
   - 0.5-0.7: Requires significant innovation
   - <0.5: Highly challenging or speculative

4. **Impact (20% weight)**: What is the potential for breakthrough or transformation?
   - 0.9-1.0: Could revolutionize the field
   - 0.7-0.9: Significant advancement expected
   - 0.5-0.7: Moderate improvement likely
   - <0.5: Incremental progress

**Calculate Total Score:**
```
totalScore = (importance × 0.35) + (novelty × 0.25) + (feasibility × 0.20) + (impact × 0.20)
```

**Example:**
```json
{
  "gap": "Lack of unified framework for evaluating interpretability of deep learning models across domains",
  "theme": "Model Interpretability",
  "scores": {
    "importance": 0.85,
    "novelty": 0.70,
    "feasibility": 0.80,
    "impact": 0.75
  },
  "totalScore": 0.78,
  "ranking": 1,
  "confidence": 0.90
}
```

Rank all gaps in **descending order** by `totalScore`.

### 3. Research Frontiers

Identify **emerging research frontiers** (areas of high potential):

- **Type**:
  - `trending` - Rapidly increasing research activity
  - `cross_domain` - Opportunities at intersection of domains
  - `methodological_innovation` - Novel methodological approaches
  - `application_expansion` - Expansion into new application areas
  
- **Description**: What is the frontier? Why is it important?
- **Supporting Evidence**: Number of papers, trends, or patterns supporting this
- **Time Horizon**: `near_term` (1-2 years), `medium_term` (3-5 years), `long_term` (5+ years)

**Example:**
```json
{
  "type": "cross_domain",
  "description": "Integration of causal inference methods with deep learning for more robust and interpretable AI systems",
  "supportingEvidence": "Emerging in 15% of papers across ML, NLP, and Computer Vision clusters",
  "timeHorizon": "near_term"
}
```

### 4. Actionable Research Directions

Generate **concrete, actionable research recommendations**:

For each direction:
- **Problem Statement**: Clear articulation of the research problem
- **Suggested Approach**: High-level methodology or approach
- **Expected Outcomes**: What would success look like?
- **Related Gaps**: Which ranked gaps does this address?

**Example:**
```json
{
  "problemStatement": "Develop standardized benchmarks for evaluating fairness in multi-modal AI systems",
  "suggestedApproach": "Create diverse, multi-modal datasets with fairness annotations; design metrics for fairness across modalities; establish evaluation protocols",
  "expectedOutcomes": "Unified framework enabling fair comparison of multi-modal models; identification of bias sources across modalities",
  "relatedGaps": [3, 7, 12]
}
```

### 5. Convergence Check

If this is **Iteration {{ITERATION}} > 1**, compare with the previous iteration:

1. Extract the **top 10 ranked gaps** from the current iteration
2. Extract the **top 10 ranked gaps** from the previous iteration (if available)
3. Calculate **Jaccard similarity**:
   - Convert gaps to word sets (lowercase, remove stopwords)
   - Calculate: `similarity = |intersection| / |union|`
4. Determine convergence:
   - `converged = true` if `similarity >= {{CONVERGENCE_THRESHOLD}}`
   - `converged = false` otherwise

**Example:**
```json
"convergence": {
  "converged": true,
  "similarity": 0.73,
  "reason": "Top 10 gaps show 73% overlap with previous iteration, exceeding threshold of 70%"
}
```

If `converged = false`, provide reason:
```json
"convergence": {
  "converged": false,
  "similarity": 0.52,
  "reason": "New cross-domain patterns identified, requiring gap re-ranking. Similarity only 52%."
}
```

---

## Prior Context

{{CONTEXT_SUMMARY}}

---

## Output Format

**CRITICAL:** Respond with valid JSON only.

```json
{
  "rankedGaps": [
    {
      "gap": "...",
      "theme": "...",
      "scores": {
        "importance": 0.0-1.0,
        "novelty": 0.0-1.0,
        "feasibility": 0.0-1.0,
        "impact": 0.0-1.0
      },
      "totalScore": 0.0-1.0,
      "ranking": 1,
      "confidence": 0.0-1.0
    }
  ],
  "crossDomainPatterns": [
    {
      "type": "methodological_trend|theoretical_convergence|application_synergy",
      "description": "...",
      "clustersInvolved": ["...", "..."],
      "confidence": 0.0-1.0
    }
  ],
  "researchFrontiers": [
    {
      "type": "trending|cross_domain|methodological_innovation|application_expansion",
      "description": "...",
      "supportingEvidence": "...",
      "timeHorizon": "near_term|medium_term|long_term"
    }
  ],
  "recommendedDirections": [
    {
      "problemStatement": "...",
      "suggestedApproach": "...",
      "expectedOutcomes": "...",
      "relatedGaps": [1, 2, 3]
    }
  ],
  "convergence": {
    "converged": true|false,
    "similarity": 0.0-1.0,
    "reason": "..."
  },
  "shouldContinue": true|false
}
```

**Note:** Set `shouldContinue = !converged` (continue if not converged, stop if converged).
