# 🚀 RMRI Quick Start Guide

## 1️⃣ Access from Navbar

Look at the top of your ResearchAI app:

```
[Home] [Research Jobs] [Semantic Search] [Presentation] [Workspace] [🤖 RMRI Agent] [Chat]
                                                                           ↑
                                                                    Click here!
```

---

## 2️⃣ What You'll See

### **Start Tab** (Default)
A beautiful form with:
- 📝 Research question input box
- 📄 PDF upload area (drag & drop)
- 🏷️ Domain selection (AI, Healthcare, etc.)
- ⚙️ Settings (iterations, confidence threshold)
- 🚀 Big "Start RMRI Run" button

---

## 3️⃣ The Simple Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: UPLOAD                                              │
│ ─────────────────────────────────────────────────────       │
│ Drag 5-10 research papers (PDFs)                            │
│                                                              │
│ Example: 10 papers on "AI for Cancer Detection"             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: CONFIGURE                                           │
│ ─────────────────────────────────────────────────────       │
│ Question: "What are gaps in AI cancer detection?"           │
│ Domains:  [x] Artificial Intelligence  [x] Healthcare       │
│ Iterations: 3                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: START                                               │
│ ─────────────────────────────────────────────────────       │
│ Click "Start RMRI Run" → Auto-switches to Progress tab      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: WATCH (Progress Tab - Auto-opened)                  │
│ ─────────────────────────────────────────────────────       │
│ ┌────────────────────────────────────────────────┐          │
│ │ Iteration 1/3                                  │          │
│ │                                                 │          │
│ │ Micro Agents:   [████████░░] 8/10 papers done  │          │
│ │ Meso Agent:     [░░░░░░░░░░] Waiting...        │          │
│ │ Meta Agent:     [░░░░░░░░░░] Waiting...        │          │
│ │                                                 │          │
│ │ Latest: "Analyzing paper: Deep Learning..."     │          │
│ └────────────────────────────────────────────────┘          │
│                                                              │
│ Real-time updates every 3 seconds! ⚡                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 5: VIEW RESULTS (Results Tab)                          │
│ ─────────────────────────────────────────────────────       │
│                                                              │
│ Research Gaps Found (Sorted by Confidence)                  │
│                                                              │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓    │
│ ┃ #  │ Gap Title                   │ Confidence     ┃    │
│ ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫    │
│ ┃ 1  │ Explainable AI Models       │ 🟢 92%        ┃    │
│ ┃ 2  │ Multi-modal Data Fusion     │ 🟢 87%        ┃    │
│ ┃ 3  │ Real-time Detection         │ 🟡 73%        ┃    │
│ ┃ 4  │ Privacy-Preserving Methods  │ 🟡 68%        ┃    │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛    │
│                                                              │
│ [Export CSV] [Download JSON]                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 6: EXPLORE                                             │
│ ─────────────────────────────────────────────────────       │
│ • Click gap row → See detailed evidence                     │
│ • Contexts tab → See what system learned                    │
│ • Admin tab → See 3D agent graph                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 4️⃣ How Agents Work Together

### The Team Structure

```
                    🎭 ORCHESTRATOR (Boss)
                           │
                    Decides: Continue or Stop?
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ↓                  ↓                  ↓
    🔬 MICRO          🧩 MESO            🎯 META
 (10 Paper Agents)  (Pattern Finder)  (Gap Finder)
        │                  │                  │
  Reads papers      Groups findings    Ranks gaps
```

### The Process

**Iteration 1:**
```
1. MICRO AGENTS (30s)
   ├─ Agent 1 reads Paper 1 → "Uses CNN, limited data"
   ├─ Agent 2 reads Paper 2 → "ResNet model, no explainability"
   ├─ Agent 3 reads Paper 3 → "Good accuracy, small dataset"
   └─ ... (all 10 papers)

2. MESO AGENT (20s)
   ├─ Clusters similar findings
   ├─ Cluster A: "Data Limitations" (5 papers)
   ├─ Cluster B: "Explainability Issues" (4 papers)
   └─ Cluster C: "Performance vs Speed" (3 papers)

3. META AGENT (25s)
   ├─ Identifies gaps from clusters
   ├─ Gap 1: "Need larger, diverse datasets" (85% confidence)
   ├─ Gap 2: "Need explainable models" (82% confidence)
   └─ Gap 3: "Need efficient architectures" (70% confidence)

4. ORCHESTRATOR (5s)
   └─ Decides: "Gaps are broad → Continue to Iteration 2"
```

**Iteration 2:** (Adds context from Iteration 1, gets more specific)
**Iteration 3:** (Even more refined)

---

## 5️⃣ Understanding Confidence Scores

### Color Coding

```
🟢 80-100%  HIGH     → Strong evidence, multiple papers
🟡 60-79%   MEDIUM   → Some evidence, needs investigation  
🔴 <60%     LOW      → Weak evidence, inferred gap
```

### What It Means

**92% Confidence = "Explainable AI needed"**
- 8/10 papers explicitly mention lack of interpretability
- Authors directly state this limitation
- Consistent across different methods

**68% Confidence = "Privacy-preserving methods"**
- 3/10 papers mention privacy concerns
- Implied from federated learning discussion
- Not the main focus of papers

---

## 6️⃣ Real Example

### Input:
```
Research Question: "Gaps in NLP for mental health?"
Papers: 8 PDFs on therapy chatbots
Domains: [AI, Psychology, Healthcare]
Iterations: 3
```

### After 5 Minutes:

```
✅ COMPLETE - 3 Iterations

RESULTS:
┌────────────────────────────────────────────────────┐
│ 1. Long-term Efficacy Studies               [92%] │
│    Evidence: 7/8 papers tested <8 weeks            │
│    Recommendation: 6-month longitudinal studies    │
│                                                     │
│ 2. Cultural Adaptation                      [87%] │
│    Evidence: All Western populations only          │
│    Recommendation: Cross-cultural models           │
│                                                     │
│ 3. Crisis Detection                         [81%] │
│    Evidence: 5 papers lack suicide risk handling  │
│    Recommendation: Real-time crisis protocols      │
└────────────────────────────────────────────────────┘
```

### Export to CSV:
```csv
Gap,Confidence,Evidence,Domain,Recommendation
"Long-term Efficacy Studies",92%,"7/8 papers tested <8 weeks",Psychology,"6-month longitudinal studies"
...
```

Use for your grant proposal! 📄

---

## 7️⃣ Tips for Best Results

### ✅ DO:
- **Upload 5-10 papers** (sweet spot for balance)
- **Use recent papers** (last 5 years)
- **Mix methodologies** (surveys, experiments, reviews)
- **Clear research question** ("What gaps in X for Y?")
- **Related domains** (2-3 connected fields)

### ❌ DON'T:
- Upload >10 papers (too slow)
- Upload <3 papers (not enough data)
- Use scanned PDFs (text extraction fails)
- Vague questions ("What about AI?")
- Unrelated domains (confuses clustering)

---

## 8️⃣ Behind the Scenes Tech

### What's Actually Happening?

**When you click "Start":**
```javascript
1. Frontend uploads PDFs to Supabase Storage
2. Backend creates database record (rmri_runs table)
3. Orchestrator creates Bull Queue job
4. Spawns 10 Micro worker processes (parallel!)
5. Each calls Cerebras LLM API
6. Results saved to rmri_contexts table
7. Meso worker processes Micro outputs
8. Meta worker ranks gaps
9. Orchestrator checks: iterate or finish?
10. Frontend polls /api/rmri/:id/status every 3s
11. Updates UI in real-time
12. Final results in rmri_research_gaps table
```

**LLMs Used:**
- **Cerebras Llama 3.1 8B** - Micro/Meso/Meta (1000+ tokens/sec!)
- **Google Gemini 1.5 Flash** - Orchestrator decisions
- **Hugging Face** - Fallback if Cerebras down

**Parallel Magic:**
```
Traditional (Sequential):
Paper 1 (30s) → Paper 2 (30s) → ... → Paper 10 (30s) = 5 minutes

RMRI (Parallel):
Papers 1-10 all at once (30s) = 30 seconds!
```

---

## 9️⃣ The Five Dashboard Tabs

```
┌─────────────────────────────────────────────────────────┐
│ [Start] [Progress] [Results] [Contexts] [Admin]        │
│   ↓        ↓         ↓          ↓          ↓            │
│  Begin   Watch    View Gaps   Browse    See Graph      │
│          Live               Knowledge                   │
└─────────────────────────────────────────────────────────┘
```

### Tab Functions:

1. **Start** - Upload papers, configure, launch
2. **Progress** - Live tracking, logs, timeline
3. **Results** - Sortable gaps table, export
4. **Contexts** - See what system learned each iteration
5. **Admin** - 3D force graph, metrics, debug

---

## 🎯 Common Use Cases

### PhD Student
```
Use: Find thesis topic gaps
Input: 10 papers in your field
Output: Ranked list of unexplored areas
Action: Pick high-confidence gap for proposal
```

### Grant Writer
```
Use: Justify research novelty
Input: 8 related works
Output: Evidence of gaps with citations
Action: Copy gaps to "Significance" section
```

### Literature Review
```
Use: Systematic gap analysis
Input: 10 survey papers
Output: Comprehensive gap landscape
Action: Structure review around gaps
```

---

## 🚀 Try It Now!

**5-Minute Challenge:**

1. Click "🤖 RMRI Agent" in navbar
2. Upload 5 papers from your Downloads folder
3. Enter: "What are the research gaps in [your field]?"
4. Select 2 domains
5. Keep default settings (3 iterations)
6. Click "Start"
7. Watch the magic happen! ✨

**Expected:** Results in ~3-4 minutes with actionable research gaps!

---

## 🎓 Academic Rigor

RMRI follows systematic review principles:

✅ **Reproducible** - Same papers = same gaps  
✅ **Evidence-based** - Every gap cited  
✅ **Transparent** - See all context/decisions  
✅ **Structured** - Multi-level analysis (Micro→Meso→Meta)  
✅ **Iterative refinement** - Gets more precise  
✅ **Confidence scoring** - Quantifies certainty  

Perfect for academic research! 🎓

---

**Questions?** Check `HOW_RMRI_WORKS.md` for deep dive! 📚
