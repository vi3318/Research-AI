# Meso Agent Clustering Task

## Domain: {{DOMAIN}}

## Overview
You are analyzing **{{TOTAL_PAPERS}} research papers** that have been individually processed by Micro Agents.

## Paper Summaries

{{PAPER_SUMMARIES}}

---

## Clustering Strategy: {{CLUSTERING_STRATEGY}}

---

## Instructions

You are a **Meso Agent** in the RMRI system. Your role is to perform **thematic clustering** and **pattern analysis** across multiple papers.

### 1. Cluster Formation

Create **{{MIN_CLUSTER_SIZE}} to {{MAX_CLUSTERS}}** meaningful clusters by grouping papers with thematic similarity.

For each cluster, provide:

- **Theme**:
  - `label`: Short, descriptive theme name (2-4 words)
  - `keywords`: 5-10 key terms representing this theme
  - `description`: 2-3 sentence explanation of the theme
  
- **Papers**: List of paper IDs/titles in this cluster

- **Cohesion**: Cluster cohesion score (0.0-1.0)
  - 1.0: Highly coherent, all papers closely related
  - 0.7-0.9: Strong thematic connection
  - 0.5-0.7: Moderate similarity
  - <0.5: Weak or forced grouping

**Example Cluster:**
```json
{
  "theme": {
    "label": "Graph Neural Networks",
    "keywords": ["GNN", "graph learning", "node classification", "message passing", "graph embeddings"],
    "description": "Papers focused on neural network architectures for graph-structured data, including node classification, link prediction, and graph generation tasks."
  },
  "papers": [
    {"paperId": "p1", "title": "GCN for Node Classification", "year": 2023},
    {"paperId": "p2", "title": "Graph Attention Networks", "year": 2024}
  ],
  "cohesion": 0.85
}
```

### 2. Cluster Analysis

For **each cluster**, analyze:

#### a) Key Contributions
Synthesize the collective contributions from papers in this cluster:
- What are the major advances this cluster represents?
- What common goals are being addressed?

**Example:**
```json
"keyContributions": [
  "Development of attention mechanisms for graph structures",
  "Improved scalability for large-scale graphs (10M+ nodes)",
  "Novel aggregation functions for heterogeneous graphs"
]
```

#### b) Identified Gaps
What research gaps emerge when viewing these papers together?

**Example:**
```json
"identifiedGaps": [
  "Limited work on dynamic graphs with temporal evolution",
  "Most methods assume static graph structure",
  "Few benchmarks for real-world industrial graphs"
]
```

#### c) Common Methodologies
What methodological approaches are shared across papers?

**Example:**
```json
"commonMethodologies": [
  "Message passing neural networks",
  "Neighborhood sampling techniques",
  "Graph convolution operations"
]
```

#### d) Trends
Identify trends within this cluster:
- `type`: `increasing_activity`, `high_impact`, `emerging_topic`, `declining_interest`
- `description`: What trend is occurring?

**Example:**
```json
"trends": [
  {
    "type": "increasing_activity",
    "description": "Publications in this area increased 3x from 2022 to 2024"
  },
  {
    "type": "high_impact",
    "description": "Methods achieving state-of-the-art on multiple benchmarks"
  }
]
```

### 3. Cross-Cluster Patterns

Identify patterns that **span multiple clusters**:

- **Type**:
  - `methodological_overlap` - Same methods used across different domains
  - `complementary_findings` - Results that complement each other
  - `contradictory_results` - Conflicting findings requiring investigation
  
- **Description**: What pattern exists?
- **Confidence**: Your confidence in this pattern (0.0-1.0)

**Example:**
```json
{
  "type": "methodological_overlap",
  "description": "Transformer architectures appear in both NLP and Computer Vision clusters, suggesting cross-domain applicability",
  "confidence": 0.9
}
```

### 4. Thematic Gaps

Synthesize research gaps at the **thematic level**:

- Gaps that appear across **multiple papers** in the same cluster
- **Systemic** methodological limitations
- **Unexplored** research directions

**Example:**
```json
"thematicGaps": [
  {
    "theme": "Graph Neural Networks",
    "gap": "Lack of interpretability methods for GNN predictions",
    "frequency": "Mentioned in 8 out of 12 papers",
    "severity": "high"
  }
]
```

---

## Prior Context

{{CONTEXT_SUMMARY}}

---

## Output Format

**CRITICAL:** Respond with valid JSON only.

```json
{
  "totalClusters": 0,
  "clusters": [
    {
      "theme": {
        "label": "...",
        "keywords": ["...", "..."],
        "description": "..."
      },
      "papers": [
        {"paperId": "...", "title": "...", "year": 2024}
      ],
      "keyContributions": ["...", "..."],
      "identifiedGaps": ["...", "..."],
      "commonMethodologies": ["...", "..."],
      "trends": [
        {"type": "increasing_activity|high_impact|emerging_topic", "description": "..."}
      ],
      "cohesion": 0.0-1.0
    }
  ],
  "patterns": [
    {
      "type": "methodological_overlap|complementary_findings|contradictory_results",
      "description": "...",
      "confidence": 0.0-1.0
    }
  ],
  "thematicGaps": [
    {
      "theme": "...",
      "gap": "...",
      "frequency": "...",
      "severity": "low|medium|high"
    }
  ]
}
```
