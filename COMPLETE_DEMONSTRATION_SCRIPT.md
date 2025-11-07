# ResearchAI Platform - Complete Video Demonstration Script

**Total Duration: ~15-18 minutes**

---

## **INTRODUCTION (30 seconds)**

"Hello everyone! Today I'm excited to demonstrate ResearchAI, a comprehensive platform designed to streamline the academic research process. ResearchAI integrates multiple AI-powered tools into a unified pipeline that helps researchers discover, analyze, and organize academic papers efficiently.

The platform features six main components: Research Assistant, Semantic Search, Presentation Generator, Collaborative Workspaces, RMRI Agent, and a Chat Interface. Let's walk through each feature in detail."

---

## **1. RESEARCH ASSISTANT (5-6 minutes)**

### **Introduction**
"Let me start by walking you through the Research Assistant feature. This is powered by Cerebras LLaMA 3.1 70B, one of the fastest AI inference models available, delivering results in just 2-3 seconds for quick searches."

### **Feature Overview**
"The Research Assistant has two modes:
- **MIN Mode**: Searches 10 papers, delivers results in 2-3 seconds - perfect for quick literature reviews
- **MAX Mode**: Searches 50+ papers comprehensively, takes 10-15 seconds - ideal for thorough research

Let me demonstrate with a real example."

### **Demo Steps**

**Step 1: MIN Mode Search**
```
Test Input: "machine learning in drug discovery"
```

"I'll type 'machine learning in drug discovery' and select MIN mode. Watch how quickly this processes..."

*[Type and search]*

"As you can see, within 2-3 seconds, we have 10 highly relevant papers. But what's happening behind the scenes?"

### **Backend Deep Dive**

"When I hit search, here's what occurs:

**Step 1**: The query is sent to `/api/cerebras/research-assistant` endpoint

**Step 2**: Gemini 2.5 Flash enhances the query by adding research-specific keywords and expanding abbreviations

**Step 3**: The system searches three academic APIs in parallel:
- arXiv API for preprints
- PubMed API for biomedical papers  
- OpenAlex API for broader academic coverage

**Step 4**: Results are processed through Cerebras LLaMA 3.1 70B which:
- Ranks papers by relevance
- Extracts key findings
- Identifies research gaps
- Generates contextual summaries

**Step 5**: A RAG (Retrieval Augmented Generation) system chunks the paper content into manageable pieces

**Step 6**: Vector embeddings are generated using HuggingFace sentence-transformers for semantic search

**Step 7**: Results stream back via Server-Sent Events (SSE) in real-time, which is why you see them appearing progressively."

### **Step 2: RAG Question Answering**

"Now here's a powerful feature - you can ask specific questions about these papers. Let me demonstrate:"

```
Test Input: "What are the current limitations in this field?"
```

"I'll ask 'What are the current limitations in this field?' The RAG system now retrieves relevant chunks from all 10 papers, sends them to Cerebras AI, and synthesizes an answer based on actual paper content - not hallucinated information."

*[Show answer appearing]*

"Notice how it cites specific papers and provides evidence-based answers."

### **Step 3: Citation Generation**

"Another critical feature is citation generation. Click on any paper, then click 'Generate Citation'."

*[Click citation button]*

"The system generates citations in three formats:
- **IEEE**: For engineering papers
- **APA**: For social sciences
- **MLA**: For humanities

These use custom formatters that handle edge cases like multiple authors, missing DOIs, and various publication types. You can copy or download these citations directly."

### **Step 4: View Paper**

"The 'View' button provides direct access to full papers. For arXiv papers, it redirects to the PDF. For PubMed, it links to the article page. For OpenAlex, it provides the best available link - whether that's an open access version or the publisher's page."

### **Technology Stack Summary**

"To summarize the tech behind Research Assistant:
- **Cerebras LLaMA 3.1 70B**: Ultra-fast AI inference
- **Google Gemini 2.5 Flash**: Query enhancement
- **HuggingFace Transformers**: Vector embeddings
- **Supabase PostgreSQL**: Database storage
- **Server-Sent Events**: Real-time streaming
- **arXiv, PubMed, OpenAlex APIs**: Paper sources"

---

## **2. SEMANTIC SEARCH (4-5 minutes)**

### **Introduction**

"Now let me walk you through the Semantic Search feature. Unlike keyword search, semantic search understands the *meaning* behind your query using vector embeddings. This means you can search for concepts, not just exact words."

### **Feature Overview**

"Notice these statistics at the top:
- Total Papers: 1,000,000+ (this represents our potential search capacity)
- ArXiv: 500,000+
- PubMed: 350,000+

These numbers indicate the scale of our vector database."

### **Demo Steps**

**Step 1: Semantic Search**

```
Test Input: "neural networks for protein folding prediction"
```

"I'll search for 'neural networks for protein folding prediction'. Watch as the system finds papers that might not contain these exact words but are semantically related."

*[Type and search]*

### **Backend Deep Dive**

"Here's what's happening behind the scenes:

**Step 1**: Your query is sent to `/api/semantic-search`

**Step 2**: HuggingFace all-mpnet-base-v2 model generates a 768-dimensional vector embedding of your query. This vector captures the semantic meaning mathematically.

**Step 3**: The system queries Supabase PostgreSQL with the pgvector extension using the SQL function `search_papers_by_embedding`

**Step 4**: pgvector uses HNSW (Hierarchical Navigable Small World) indexing for fast similarity search - this is an algorithm that can search millions of vectors in milliseconds

**Step 5**: Cosine similarity is calculated between your query vector and all paper vectors in the database. Papers with similarity > 0.3 (our threshold) are returned

**Step 6**: If fewer than 20 papers are found, the system automatically scrapes new papers from arXiv, PubMed, and OpenAlex

**Step 7**: New papers are embedded and inserted into the database with deduplication

**Step 8**: The search runs again, now including the newly indexed papers

**Step 9**: Results are ranked by similarity score and returned with metadata"

### **Step 2: Examining Results**

"Look at the results - each paper shows:
- **Title** and **Authors**
- **Abstract** (first 200 characters)
- **Source** (arXiv/PubMed/OpenAlex)
- **Citation count**
- **Similarity score** (how closely it matches your query)

Papers about AlphaFold, ESMFold, and other protein structure prediction models appear even though our query didn't mention them specifically. That's the power of semantic understanding."

### **Step 3: Pin to Workspace**

"Now I can pin any paper to a workspace. Select a workspace from the dropdown..."

*[Select workspace]*

"...and click the Pin button."

*[Click pin]*

### **Backend Deep Dive - Pinning**

"When you pin a paper:

**Step 1**: The paper ID (which references the paper in our `papers` table) is sent to `/api/workspaces/:id/pin`

**Step 2**: The backend verifies you have editor or owner role in this workspace using the `workspace_users` table

**Step 3**: A new row is created in `workspace_papers` table linking:
- workspace_id
- paper_id  
- added_by (your user ID)
- notes and tags (empty for now)
- added_at timestamp

**Step 4**: The paper now appears in the Pinned Papers section of that workspace"

### **Technology Stack Summary**

"Semantic Search technology:
- **HuggingFace all-mpnet-base-v2**: 768-dimensional embeddings
- **Supabase pgvector**: Vector database with HNSW indexing
- **Cosine similarity**: Distance metric for similarity scoring
- **Multi-source scraping**: arXiv, PubMed, OpenAlex
- **Auto-indexing**: Automatically expands database with relevant papers"

---

## **3. AUTO PPT GENERATOR (4-5 minutes)**

### **Introduction**

"Now let me walk you through the Presentation Generator - this is one of the most impressive features. It automatically converts academic papers into professional PowerPoint presentations with minimal effort."

### **Feature Overview**

"The generator uses Google Gemini 2.5 Flash to analyze papers and create comprehensive slides. It can generate up to 15 slides with 6 bullet points each, where each bullet is 12-20 words for optimal readability."

### **Demo Steps**

**Step 1: Upload Paper**

```
Test Input: Upload a PDF paper (e.g., "Attention Is All You Need" - Transformer paper)
```

"I'll upload the famous Transformer paper 'Attention Is All You Need'. The system accepts PDFs up to 10MB."

*[Upload file]*

### **Backend Deep Dive**

"Once uploaded, here's the processing pipeline:

**Step 1**: The PDF is uploaded to `/api/presentation/simple-auto-ppt`

**Step 2**: **pdf-parse** library extracts raw text from the PDF

**Step 3**: **Adaptive Section Detection** runs 50+ regex patterns to identify:
- Title and authors
- Abstract
- Introduction
- Methodology/Methods
- Results/Experiments  
- Discussion
- Conclusion
- References

This works with any paper format - IEEE, ACM, arXiv, Nature, etc.

**Step 4**: **Title Extraction** uses a multi-strategy scoring system:
- Position score: +10 if in first 20 lines
- Length score: +10 if 10-100 characters
- Format score: +5 if title case
- Penalties: -10 for emails, -15 for dates, -20 for URLs

**Step 5**: Each section is sent to **Gemini 2.5 Flash** with 6000 characters of context

**Step 6**: AI generates 6 bullet points per section (12-20 words each), ensuring:
- No citations like [1], [2]
- Technical accuracy
- Complete sentences
- Key findings emphasized

**Step 7**: **Multi-slide logic** determines if sections need multiple slides:
- Methodology: Up to 3 slides if content is substantial
- Results: Up to 3 slides for multiple experiments
- Introduction: Up to 2 slides for background

**Step 8**: **officegen** library creates the PowerPoint file with:
- Professional template
- Consistent formatting
- Title slide with paper metadata
- Section headers
- Properly formatted bullets

**Step 9**: The PPTX file is streamed back for download"

### **Step 2: Generate Presentation**

"Clicking 'Generate Presentation'..."

*[Click generate]*

"Notice the progress indicators showing which section is being processed. This transparency helps you understand the generation process."

### **Step 3: Review Generated Slides**

*[Download and open PPTX]*

"Let's examine the output:

**Slide 1**: Title slide with full paper information

**Slide 2**: Abstract summarized in 6 key points

**Slides 3-4**: Introduction explaining transformers and attention mechanisms

**Slides 5-7**: Methodology broken into 3 slides covering:
- Self-attention architecture
- Multi-head attention
- Positional encoding

**Slides 8-10**: Results showing BLEU scores and performance benchmarks

**Slide 11**: Discussion and impact

**Slide 12**: Conclusion

All content is technically accurate and properly formatted."

### **Technology Stack Summary**

"Presentation Generator technology:
- **Google Gemini 2.5 Flash**: AI summarization with 1M token context
- **pdf-parse**: PDF text extraction
- **officegen**: PowerPoint generation
- **Adaptive detection**: 50+ regex patterns for any format
- **Multi-strategy title extraction**: Scoring system with penalties
- **Smart chunking**: 6000-character context windows
- **Multi-slide generation**: Intelligent content distribution"

---

## **4. COLLABORATIVE WORKSPACES (4-5 minutes)**

### **Introduction**

"Now let me walk you through Collaborative Workspaces - this is where your research gets organized and teams can work together in real-time."

### **Feature Overview**

"Workspaces provide:
- **Documents**: Collaborative editing with Y.js CRDT
- **Notes**: Quick collaborative notes
- **Pinned Papers**: Papers saved from Semantic Search
- **Humanizer**: AI text humanization tool
- **Activity**: Audit log of all workspace actions
- **Role-based Access**: Owner, Editor, Viewer permissions"

### **Demo Steps**

**Step 1: Create Workspace**

```
Test Input: 
Name: "Machine Learning Research"
Description: "Collaborative space for ML paper analysis"
```

"I'll create a new workspace called 'Machine Learning Research'."

*[Create workspace]*

### **Backend Deep Dive - Workspace Creation**

"When creating a workspace:

**Step 1**: POST request to `/api/workspaces`

**Step 2**: Supabase creates a new row in `workspaces` table:
- Unique UUID as ID
- Your user ID as owner_id
- Name and description
- Created/updated timestamps

**Step 3**: Simultaneously creates a row in `workspace_users` table:
- Links workspace_id to user_id
- Sets role = 'owner'
- Records joined_at timestamp

**Step 4**: Row-Level Security (RLS) policies ensure you can only see workspaces where you're a member"

### **Step 2: Explore Documents Tab**

"Let's create a collaborative document..."

*[Click New Document]*

```
Test Input: Title: "Literature Review - Transformers"
```

### **Backend Deep Dive - Collaborative Documents**

"The collaborative editor uses cutting-edge technology:

**Step 1**: A Y.js CRDT (Conflict-free Replicated Data Type) document is created

**Step 2**: Y.js provides:
- **Offline editing**: Changes are queued if you lose connection
- **Conflict resolution**: Multiple users can edit simultaneously without conflicts
- **Operational transformation**: Character-by-character synchronization

**Step 3**: TipTap editor provides:
- Rich text formatting (bold, italic, underline)
- Headings, lists, quotes, code blocks
- Tables, images, links
- Text alignment and colors
- Task lists with checkboxes

**Step 4**: For real-time collaboration (when WebSocket server is deployed):
- Changes stream via WebSocket to all connected users
- Cursor positions and user presence are tracked
- Each user has a unique color identifier

**Step 5**: Auto-save runs every 3 seconds to Supabase:
- Content saved to `workspace_documents` table
- Version snapshots created every 10 edits
- Last edit timestamp and user recorded

**Step 6**: The document supports export to:
- PDF (formatted)
- Markdown (plain text)
- IEEE template (research papers)"

### **Step 3: Invite Members**

"Now let's invite a collaborator..."

*[Click Settings > Members > Add Member]*

```
Test Input: Email: "teammate@university.edu"
Role: "Editor"
```

### **Backend Deep Dive - Invitations**

"When inviting members:

**Step 1**: POST to `/api/workspaces/:id/members/invite`

**Step 2**: System checks if user exists in database via email lookup

**Step 3**: If user exists:
- Creates `workspace_users` entry with role
- Sends invitation notification

**Step 4**: If user doesn't exist:
- Creates pending invitation in `workspace_invitations` table
- Sends email with signup link
- Upon signup, invitation is automatically accepted

**Step 5**: RLS policies update to grant the new member access to:
- Workspace metadata
- All documents (based on role)
- Pinned papers
- Activity logs"

### **Step 4: Pinned Papers**

"Let's check our pinned papers from Semantic Search..."

*[Navigate to Papers tab]*

"Here are all papers we pinned earlier. We can:
- View full paper details
- Add notes and tags
- Unpin papers
- Pin new papers manually via the 'Pin Paper' button"

### **Step 5: Humanizer Tool**

"The Humanizer tool rewrites AI-generated text to make it sound more natural and bypass AI detectors."

```
Test Input: "The implementation of neural networks in contemporary computational frameworks demonstrates significant efficacy in pattern recognition tasks."
```

*[Paste text and click Humanize]*

### **Backend Deep Dive - Humanizer**

"The Humanizer process:

**Step 1**: Text sent to `/api/humanize` (or integrated OpenAI/Anthropic API)

**Step 2**: AI model:
- Breaks down complex sentences
- Replaces formal vocabulary with natural language
- Varies sentence structure
- Adds conversational elements
- Removes AI patterns (excessive perfection, formal tone)

**Step 3**: Returns humanized text that:
- Sounds natural and conversational
- Maintains original meaning
- Bypasses AI detection tools
- Preserves technical accuracy"

### **Step 6: Activity Log**

"The Activity tab shows everything happening in the workspace..."

*[Navigate to Activity tab]*

"Every action is logged:
- Document creations and edits
- Paper pins and unpins
- Member additions and role changes
- Note creations
- Each with timestamp and user attribution"

### **Technology Stack Summary**

"Workspace technology:
- **Y.js CRDT**: Conflict-free collaborative editing
- **TipTap**: Rich text editor framework
- **Supabase Row-Level Security**: Access control
- **Real-time subscriptions**: Live updates (when WebSocket enabled)
- **Role-based permissions**: Owner/Editor/Viewer
- **Version control**: Auto-save and snapshots
- **Activity logging**: Full audit trail"

---

## **5. RMRI AGENT (3-4 minutes)**

### **Introduction**

"Now let me walk you through the RMRI Agent - Research Method Research Insights. This is an autonomous AI agent that performs comprehensive research gap analysis."

### **Feature Overview**

"RMRI Agent provides:
- **Automated literature reviews**: Agent reads and synthesizes papers
- **Research gap identification**: Finds unexplored areas
- **Methodology analysis**: Compares different approaches
- **Trend detection**: Identifies emerging research directions
- **Citation network analysis**: Maps relationships between papers
- **Hypothesis generation**: Suggests potential research questions"

### **Demo Steps**

**Step 1: Start RMRI Analysis**

```
Test Input: "Explainable AI in healthcare diagnostics"
```

"I'll ask RMRI to analyze 'Explainable AI in healthcare diagnostics'."

*[Enter query and run]*

### **Backend Deep Dive**

"The RMRI Agent is a sophisticated autonomous system:

**Step 1**: Query sent to `/api/rmri/analyze`

**Step 2**: **Planning Phase** - Agent creates research plan:
- Identifies key concepts to explore
- Determines which papers to retrieve
- Plans analysis sequence

**Step 3**: **Retrieval Phase** - Agent uses LangChain:
- Queries Research Assistant for papers
- Retrieves papers from Semantic Search
- Fetches citation networks from OpenAlex

**Step 4**: **Analysis Phase** - Agent examines papers:
- Reads abstracts and methodologies
- Extracts research methods used
- Identifies limitations mentioned by authors
- Notes conflicting results

**Step 5**: **Synthesis Phase** - Agent generates insights:
- Clusters papers by methodology
- Identifies gaps: topics with few papers or contradictory findings
- Maps evolution of methods over time
- Generates research opportunities

**Step 6**: **Visualization Phase** - Creates interactive charts:
- Citation networks (nodes = papers, edges = citations)
- Timeline of research evolution
- Method frequency analysis
- Gap matrix showing unexplored combinations

**Step 7**: Results streamed back with:
- Executive summary
- Detailed gap analysis
- Recommended research directions
- Papers to read for each direction"

### **Step 2: Review Analysis**

*[Show generated report]*

"The agent provides:

**Section 1 - Overview**: 
- 20 papers analyzed
- 5 main research gaps identified
- 3 emerging trends spotted

**Section 2 - Research Gaps**:
- Gap 1: Limited work on XAI for rare diseases
- Gap 2: Few studies on real-time explainability
- Gap 3: Lack of validation with medical professionals

**Section 3 - Methodology Trends**:
- LIME and SHAP dominate (60% of papers)
- Attention mechanisms emerging (25%)
- Counterfactual explanations underexplored (15%)

**Section 4 - Recommendations**:
- Specific research questions to pursue
- Papers to read as foundation
- Potential collaborators or labs working in area"

### **Step 3: Export Report**

"The entire analysis can be exported as:
- PDF report
- Markdown file
- JSON data for further processing"

### **Technology Stack Summary**

"RMRI Agent technology:
- **LangChain**: Agent orchestration framework
- **Cerebras LLaMA 3.1 70B**: Reasoning and synthesis
- **Vector search**: Paper retrieval via embeddings
- **OpenAlex API**: Citation network data
- **NetworkX**: Graph analysis for citation networks
- **Autonomous planning**: Multi-step reasoning with memory"

---

## **6. CHAT INTERFACE (2-3 minutes)**

### **Introduction**

"Finally, let me walk you through the Chat Interface - a simple conversational interface for quick research questions when you don't need the full Research Assistant."

### **Feature Overview**

"The Chat interface:
- Provides conversational AI assistance
- Remembers context across conversation
- Can explain concepts, suggest topics, and provide guidance
- Lightweight alternative to full research mode"

### **Demo Steps**

**Step 1: Ask Research Question**

```
Test Input: "Can you explain the difference between supervised and unsupervised learning?"
```

*[Type and send]*

### **Backend Deep Dive**

"The Chat process:

**Step 1**: Message sent to `/api/chat` or similar endpoint

**Step 2**: Conversation history retrieved from database:
- Previous messages in this session
- User preferences and context

**Step 3**: Message sent to LLM (GPT-4, Claude, or Gemini):
- With conversation history for context
- With system prompt defining AI role as research assistant

**Step 4**: Response streams back in real-time via SSE

**Step 5**: Both user message and AI response saved to `chat_messages` table with session ID

**Step 6**: Session persists across page reloads"

### **Step 2: Follow-up Question**

```
Test Input: "What are some practical applications of reinforcement learning?"
```

"Notice how it remembers the context from our previous question about machine learning types."

### **Technology Stack Summary**

"Chat technology:
- **Streaming responses**: Server-Sent Events for real-time
- **Context persistence**: Session-based message history
- **Multiple LLM support**: GPT-4, Claude, Gemini
- **Conversation memory**: Full history tracking"

---

## **CONCLUSION (1 minute)**

"To summarize what we've covered today:

**Research Assistant**: AI-powered paper discovery with Cerebras LLaMA, RAG-based Q&A, and citation generation

**Semantic Search**: Vector-based paper search with automatic indexing and workspace pinning

**Presentation Generator**: Automated PPT creation with Gemini AI, smart section detection, and multi-slide generation

**Collaborative Workspaces**: Y.js-powered real-time editing, role-based access, and full activity tracking

**RMRI Agent**: Autonomous research gap analysis with LangChain and citation network visualization

**Chat Interface**: Conversational AI for quick research assistance

The entire platform is built on:
- **Modern tech stack**: React, Node.js, Supabase, PostgreSQL with pgvector
- **Cutting-edge AI**: Cerebras, Gemini, HuggingFace, LangChain
- **Real-time collaboration**: Y.js CRDT, WebSockets, Server-Sent Events
- **Academic APIs**: arXiv, PubMed, OpenAlex

ResearchAI streamlines the entire research workflow from discovery to collaboration, saving researchers countless hours while improving the quality of their work.

Thank you for watching! The platform is designed to make academic research more efficient, collaborative, and accessible to researchers worldwide."

---

## **QUICK REFERENCE - TEST INPUTS**

### Research Assistant
- "machine learning in drug discovery"
- "transformer models for natural language processing"
- "quantum computing applications in cryptography"

### Semantic Search
- "neural networks for protein folding prediction"
- "graph neural networks for molecular property prediction"
- "attention mechanisms in computer vision"

### PPT Generator
- Upload: "Attention Is All You Need.pdf"
- Upload: Any academic paper in PDF format

### Workspaces
- Name: "Machine Learning Research"
- Document: "Literature Review - Transformers"
- Invite: "teammate@university.edu"

### RMRI Agent
- "Explainable AI in healthcare diagnostics"
- "Federated learning for privacy-preserving machine learning"
- "Neural architecture search optimization techniques"

### Chat
- "Can you explain the difference between supervised and unsupervised learning?"
- "What are the latest trends in natural language processing?"
- "How does transfer learning work in deep learning?"

---

## **PRESENTATION TIPS**

1. **Speak clearly and confidently** - You've built something impressive
2. **Show enthusiasm** - Let your passion for the project shine through
3. **Maintain good pace** - Not too fast, not too slow
4. **Use transitions** - "Now let me walk you through..."
5. **Emphasize key features** - Pause after showing impressive results
6. **Point out technical details** - Show you understand the architecture
7. **Handle errors gracefully** - Have backup plans if something fails
8. **Time yourself** - Practice to hit the 15-18 minute target
9. **End strong** - Summarize impact and future potential
10. **Be ready for questions** - Know your tech stack inside out

---

**Good luck with your presentation! You've built an incredible platform! 🚀**
