# 🤖 How RMRI Agent Works - Simple Explanation

## What is RMRI?

**RMRI = Recursive Multi-Resolution Integration**

Think of it as a **smart research assistant** that reads academic papers and finds **research gaps** (areas that need more study) by analyzing them at different levels - like zooming in and out on a map! 🗺️

---

## 🎯 What It Does

**Input:** You give it:
- Your research question (e.g., "Find gaps in AI for healthcare")
- 5-10 research papers (PDFs)
- Research domain (AI, Healthcare, etc.)

**Output:** You get:
- List of **ranked research gaps** (things that haven't been studied enough)
- **Confidence scores** (how sure it is about each gap)
- **Evidence** (which papers support this gap)
- **Recommendations** (what research should be done next)

---

## 📖 How It Works - Step by Step

### Step 1: **You Start a New Run** 📝
1. Click "🤖 RMRI Agent" in the navbar
2. Enter your research question
3. Upload PDF papers (up to 10)
4. Select domains (AI, Healthcare, etc.)
5. Choose iterations (1-10, default is 3)
6. Click **"Start RMRI Run"**

### Step 2: **Micro Agents Analyze Papers** 🔬
**What happens:**
- System creates **one agent per paper**
- Each agent reads its paper carefully
- Extracts key information:
  - Research questions
  - Methods used
  - Findings
  - Limitations mentioned
  - What the authors say is missing

**Example:**
```
Paper: "Deep Learning for Cancer Detection"
Micro Agent finds:
- Main method: CNN with ResNet
- Limitation: "Small dataset (only 500 samples)"
- Gap mentioned: "Need more diverse patient data"
```

**Time:** ~30 seconds per paper

### Step 3: **Meso Agent Finds Patterns** 🧩
**What happens:**
- Takes all Micro agent findings
- Groups similar findings into **clusters**
- Finds **themes** across papers

**Example:**
```
Cluster 1: "Data Scarcity"
- 3 papers mention small datasets
- 2 papers mention lack of diversity

Cluster 2: "Model Explainability"
- 4 papers say models are "black boxes"
- Hard to trust in medical settings
```

**Time:** ~20 seconds

### Step 4: **Meta Agent Identifies Gaps** 🎯
**What happens:**
- Looks at all clusters
- Finds what's **missing** across all research
- Ranks gaps by importance
- Assigns confidence scores

**Example:**
```
Gap #1: "Explainable AI for Medical Diagnosis" 
- Confidence: 85%
- Evidence: 6 papers mention lack of interpretability
- Impact: High (affects patient trust)

Gap #2: "Multi-modal Cancer Detection"
- Confidence: 72%
- Evidence: 4 papers use only images, not text+images
- Impact: Medium
```

**Time:** ~25 seconds

### Step 5: **Orchestrator Decides** 🎭
**What happens:**
- Reviews all findings
- Decides: "Should we run another iteration?"
- If yes: Uses findings as **context** for next round
- If no: Returns final results

**Why iterate?**
Each iteration adds more context, making gaps more specific!

**Iteration 1:** "Need better data"
**Iteration 2:** "Need diverse patient data from multiple hospitals"
**Iteration 3:** "Need standardized protocol for multi-center data collection with privacy preservation"

**Time:** ~5 seconds decision

### Step 6: **You See Results** 📊
**What you get:**
- **Results Tab:** Table of ranked gaps
- **Progress Tab:** Live tracking with timeline
- **Contexts Tab:** See what each iteration learned
- **Admin Tab:** 3D graph of how agents worked together

---

## 🔄 The Iteration Loop

```
Start → Micro Agents → Meso Agent → Meta Agent → Orchestrator
                                                      ↓
                                           Check if done?
                                                   ↙     ↘
                                                Yes      No
                                                 ↓        ↓
                                           Return    Add context
                                           Results   → Loop back
```

**Each iteration gets smarter** by building on previous findings!

---

## 🎨 The Dashboard Tabs

### 1️⃣ **Start Tab** (Where you begin)
- Upload papers
- Enter research question
- Set configuration
- Start the run

### 2️⃣ **Progress Tab** (Watch it work)
- See current iteration (1/3, 2/3, etc.)
- Agent status (Micro: 5/10 papers done)
- Live logs
- Timeline of what happened

### 3️⃣ **Results Tab** (Your answers)
- Sortable table of gaps
- Filter by confidence (High/Medium/Low)
- Export to CSV
- Click to see evidence

### 4️⃣ **Contexts Tab** (The knowledge)
- Browse what system learned
- See version history
- Download context data

### 5️⃣ **Admin Tab** (The system view)
- 3D graph of agents
- See how they connected
- Execution metrics

---

## 🧠 Behind the Scenes (Technical)

### The Agents

**Micro Agent** (Paper Analyzer)
- Reads: Individual paper
- Uses: Cerebras LLM (fast AI model)
- Output: Paper summary + findings

**Meso Agent** (Pattern Finder)
- Reads: All Micro outputs
- Uses: Cerebras LLM
- Output: Clusters + themes

**Meta Agent** (Gap Identifier)
- Reads: All Meso clusters
- Uses: Cerebras LLM
- Output: Ranked gaps + confidence

**Orchestrator** (Decision Maker)
- Reads: Meta output
- Uses: Google Gemini (for strategic thinking)
- Output: Continue or finish?

### The Tech Stack

**Backend:**
- Node.js + Express
- PostgreSQL (database)
- Redis + Bull (job queue for parallel processing)
- Supabase (auth + storage)

**LLM Services:**
- Cerebras API (primary - super fast)
- Hugging Face (fallback)
- Google Gemini (orchestration)

**Frontend:**
- React + TypeScript
- Tailwind CSS (styling)
- Framer Motion (smooth animations)
- Real-time updates (polling every 3s)

---

## ⚡ Why It's Fast

1. **Parallel Processing:** All Micro agents run at the same time
2. **Fast LLM:** Cerebras can process 1000+ tokens/second
3. **Smart Caching:** Reuses context between iterations
4. **Optimized Prompts:** Templates designed for efficiency

**Example Timeline:**
```
Total time for 10 papers, 3 iterations: ~5 minutes

Iteration 1:
├─ Micro (10 papers in parallel): 30s
├─ Meso: 20s
└─ Meta: 25s
   → Subtotal: ~75s

Iteration 2 (with context): ~70s
Iteration 3 (with context): ~65s

Total: ~210s ≈ 3.5 minutes
Plus setup/finalization: ~5 minutes
```

---

## 💡 Example Use Case

**Scenario:** PhD student studying "AI for Mental Health"

**Step 1:** Upload 8 papers on AI therapy chatbots

**Step 2:** Enter question: "What gaps exist in AI mental health interventions?"

**Step 3:** System runs (3 iterations)

**Step 4:** Gets results:

```
Gap #1: Lack of Long-term Efficacy Studies
- Confidence: 92%
- Evidence: 7/8 papers only tested for 4-8 weeks
- Recommendation: "Conduct 6-month+ longitudinal studies"

Gap #2: Cultural Adaptation of AI Therapists
- Confidence: 87%
- Evidence: All papers tested on Western populations only
- Recommendation: "Develop culturally-aware conversation models"

Gap #3: Integration with Human Therapists
- Confidence: 78%
- Evidence: 5 papers mention lack of hybrid models
- Recommendation: "Design collaborative AI-human therapy protocols"
```

**Step 5:** Student uses these gaps for research proposal! 🎓

---

## 🎯 Key Benefits

✅ **Saves Time:** Analyzes 10 papers in 5 minutes (vs hours manually)
✅ **Objective:** No human bias in identifying gaps
✅ **Comprehensive:** Finds patterns across all papers
✅ **Evidence-Based:** Every gap backed by citations
✅ **Iterative:** Gets more specific with each round
✅ **Ranked:** Shows most important gaps first

---

## 🚀 Quick Start

1. **Click** "🤖 RMRI Agent" in navbar
2. **Upload** your research papers (PDF)
3. **Enter** your research question
4. **Select** domains
5. **Click** "Start RMRI Run"
6. **Watch** progress in real-time
7. **Review** results and export!

---

## 🔐 Security

- ✅ All papers stored securely in Supabase
- ✅ Only you can see your data
- ✅ Papers encrypted at rest
- ✅ Automatic cleanup after 30 days

---

## 📊 What Makes a Good Research Gap?

**High Confidence (80%+):**
- Mentioned in multiple papers
- Clear evidence of limitation
- Specific and actionable

**Medium Confidence (60-80%):**
- Mentioned in some papers
- Implied limitation
- Somewhat specific

**Low Confidence (<60%):**
- Inferred from absence
- Broad or vague
- Needs more investigation

---

## 🎓 Real-World Applications

**For Students:**
- Find thesis topics
- Literature review automation
- Identify research directions

**For Researchers:**
- Grant proposal gaps
- Systematic review assistance
- Competitive analysis

**For Labs:**
- Strategic research planning
- Resource allocation
- Trend analysis

---

## 🐛 Troubleshooting

**Q: Upload failing?**
- Check file is PDF
- Max 10 papers per run
- Each file < 10MB

**Q: Taking too long?**
- More papers = longer time
- Check backend is running
- See progress in logs

**Q: Low confidence scores?**
- Papers might not be related
- Try more specific domains
- Use more iterations (5-7)

**Q: No gaps found?**
- Papers might be too similar
- Try diverse paper selection
- Check research question clarity

---

## 📈 Advanced Tips

**Better Results:**
1. **Diverse Papers:** Mix recent + classic papers
2. **Clear Question:** Specific > General
3. **Right Domains:** Choose 2-3 related domains
4. **More Iterations:** 5-7 for complex topics
5. **Quality PDFs:** Well-formatted, text-based (not scanned images)

**Interpreting Results:**
1. **High Confidence + High Impact = Priority Gap**
2. **Cross-reference evidence with original papers**
3. **Look for gaps mentioned across iterations**
4. **Check context evolution in Contexts tab**

---

## 🎉 That's It!

RMRI automates what would take **hours of manual work** into **5 minutes of AI-powered analysis**!

**Remember:** It's like having a research team of 13+ agents working together:
- 10 Micro agents (paper readers)
- 1 Meso agent (pattern finder)  
- 1 Meta agent (gap identifier)
- 1 Orchestrator (decision maker)

All coordinated to find the best research opportunities for you! 🚀

---

**Need Help?** Check the tooltips in the UI or ask in the chat! 💬
