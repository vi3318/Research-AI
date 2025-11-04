/**
 * LangChain-Powered RMRI Agent Service
 * 
 * Leverages LangChain's powerful features:
 * - Agent framework with tools
 * - Chain-of-thought reasoning
 * - Memory management
 * - Document loaders and text splitters
 * - Vector stores for semantic search
 * - Prompt templates and structured outputs
 */

const { ChatOpenAI } = require('@langchain/openai');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { PromptTemplate, ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');
const { DynamicTool, DynamicStructuredTool } = require('@langchain/core/tools');
// Note: Agent imports disabled for LangChain v1.0 compatibility
// const { AgentExecutor, createOpenAIFunctionsAgent } = require('langchain/agents');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { MemoryVectorStore } = require('@langchain/community/vectorstores/memory');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { StructuredOutputParser } = require('@langchain/core/output_parsers');
const { z } = require('zod');
const debug = require('debug')('researchai:langchain-rmri');

class LangChainRMRIService {
  constructor() {
    this.llm = null;
    this.embeddings = null;
    this.initialized = false;
  }

  /**
   * Initialize LangChain models
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize LLM - Use Google's Gemini via LangChain
      if (process.env.GOOGLE_API_KEY) {
        this.llm = new ChatGoogleGenerativeAI({
          modelName: 'gemini-pro',
          apiKey: process.env.GOOGLE_API_KEY,
          temperature: 0.7,
          maxOutputTokens: 2048
        });

        this.embeddings = new GoogleGenerativeAIEmbeddings({
          apiKey: process.env.GOOGLE_API_KEY,
          modelName: 'embedding-001'
        });

        debug('✅ Initialized Google Gemini LLM and Embeddings');
      } else if (process.env.OPENAI_API_KEY) {
        // Fallback to OpenAI if available
        const { OpenAIEmbeddings } = require('@langchain/openai');
        
        this.llm = new ChatOpenAI({
          modelName: 'gpt-4',
          temperature: 0.7,
          apiKey: process.env.OPENAI_API_KEY
        });

        this.embeddings = new OpenAIEmbeddings({
          apiKey: process.env.OPENAI_API_KEY
        });

        debug('✅ Initialized OpenAI LLM and Embeddings');
      } else {
        throw new Error('No API key found for LLM (GOOGLE_API_KEY or OPENAI_API_KEY required)');
      }

      this.initialized = true;
    } catch (error) {
      debug('❌ Failed to initialize LangChain:', error.message);
      throw error;
    }
  }

  /**
   * Create a Research Gap Analysis Agent with Tools
   * Uses LangChain's agent framework with custom tools
   */
  async createResearchGapAgent(papers, query, config = {}) {
    await this.initialize();

    // Define research analysis tools
    const tools = [
      new DynamicTool({
        name: 'semantic_search',
        description: 'Search papers semantically to find relevant content. Input should be a search query.',
        func: async (searchQuery) => {
          return await this.semanticSearchPapers(papers, searchQuery);
        }
      }),

      new DynamicTool({
        name: 'identify_methodologies',
        description: 'Extract and analyze research methodologies from papers. Input should be paper content.',
        func: async (content) => {
          return await this.extractMethodologies(content);
        }
      }),

      new DynamicTool({
        name: 'find_research_trends',
        description: 'Identify research trends and patterns across papers. No input required.',
        func: async () => {
          return await this.identifyTrends(papers);
        }
      }),

      new DynamicTool({
        name: 'gap_analyzer',
        description: 'Analyze gaps between current research and opportunities. Input should be research area.',
        func: async (area) => {
          return await this.analyzeGaps(papers, area);
        }
      })
    ];

    // Create agent with tools
    const agent = await createOpenAIFunctionsAgent({
      llm: this.llm,
      tools,
      prompt: ChatPromptTemplate.fromMessages([
        ['system', `You are an expert research analyst specialized in identifying research gaps and opportunities.
        
Your task is to analyze research papers and identify:
1. Current state of the art
2. Research gaps and limitations
3. Future research directions
4. Methodological opportunities

Research Query: {query}

Use the available tools to conduct thorough analysis.`],
        ['human', '{input}'],
        new MessagesPlaceholder('agent_scratchpad')
      ])
    });

    // TODO: Re-implement with LangChain v1.0 agent pattern
    // For now, return a simple chain instead
    debug('Agent creation disabled for LangChain v1.0 compatibility');
    
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'You are a research assistant with access to tools.'],
      ['human', '{input}']
    ]);
    
    return prompt.pipe(this.llm);
  }

  /**
   * Semantic Search using Vector Store
   */
  async semanticSearchPapers(papers, searchQuery, topK = 5) {
    await this.initialize();

    try {
      // Split papers into chunks
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200
      });

      const docs = [];
      for (const paper of papers) {
        const content = `Title: ${paper.title}\n\nAbstract: ${paper.abstract || ''}\n\nContent: ${paper.content || ''}`;
        const chunks = await textSplitter.createDocuments([content], [{ 
          title: paper.title,
          paperId: paper.id 
        }]);
        docs.push(...chunks);
      }

      // Create vector store
      const vectorStore = await MemoryVectorStore.fromDocuments(
        docs,
        this.embeddings
      );

      // Perform similarity search
      const results = await vectorStore.similaritySearch(searchQuery, topK);

      return JSON.stringify(results.map(doc => ({
        content: doc.pageContent,
        metadata: doc.metadata,
        relevance: 'high'
      })));
    } catch (error) {
      debug('❌ Semantic search error:', error.message);
      return 'Error performing semantic search';
    }
  }

  /**
   * Extract Methodologies using Structured Output
   */
  async extractMethodologies(content) {
    await this.initialize();

    // Define output schema
    const methodologySchema = z.object({
      methodologies: z.array(z.object({
        name: z.string().describe('Methodology name'),
        description: z.string().describe('Brief description'),
        category: z.enum(['experimental', 'computational', 'theoretical', 'survey', 'other'])
          .describe('Methodology category')
      }))
    });

    const parser = StructuredOutputParser.fromZodSchema(methodologySchema);

    const prompt = PromptTemplate.fromTemplate(
      `Extract all research methodologies from the following content.

{format_instructions}

Content:
{content}

Methodologies:`
    );

    const chain = prompt.pipe(this.llm).pipe(parser);

    try {
      const result = await chain.invoke({
        content: content.substring(0, 4000), // Limit content length
        format_instructions: parser.getFormatInstructions()
      });

      return JSON.stringify(result);
    } catch (error) {
      debug('❌ Methodology extraction error:', error.message);
      return JSON.stringify({ methodologies: [] });
    }
  }

  /**
   * Identify Research Trends using Chain-of-Thought
   */
  async identifyTrends(papers) {
    await this.initialize();

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'You are an expert at identifying research trends and patterns.'],
      ['human', `Analyze the following {count} research papers and identify key trends:

Papers:
{papers}

Identify:
1. Emerging research themes
2. Popular methodologies
3. Growing research areas
4. Declining topics

Provide a structured analysis.`]
    ]);

    const chain = prompt.pipe(this.llm);

    try {
      const papersSummary = papers.slice(0, 10).map((p, i) => 
        `${i + 1}. ${p.title} (${p.year || 'N/A'})`
      ).join('\n');

      const result = await chain.invoke({
        count: papers.length,
        papers: papersSummary
      });

      return result.content;
    } catch (error) {
      debug('❌ Trend identification error:', error.message);
      return 'Error identifying trends';
    }
  }

  /**
   * Analyze Research Gaps using Multi-Step Reasoning
   */
  async analyzeGaps(papers, researchArea) {
    await this.initialize();

    // Create a chain for gap analysis
    const gapAnalysisPrompt = PromptTemplate.fromTemplate(
      `You are conducting a comprehensive gap analysis for: {research_area}

Based on {paper_count} papers, perform the following steps:

STEP 1: What are the most common approaches used in this research area?
STEP 2: What are the stated limitations in the papers?
STEP 3: What questions remain unanswered?
STEP 4: What are the potential future research directions?
STEP 5: Synthesize into key research gaps

Paper Titles:
{papers}

Provide a detailed gap analysis with specific, actionable gaps.`
    );

    try {
      const paperTitles = papers.slice(0, 15).map((p, i) => 
        `${i + 1}. ${p.title}`
      ).join('\n');

      const formattedPrompt = await gapAnalysisPrompt.format({
        research_area: researchArea,
        paper_count: papers.length,
        papers: paperTitles
      });

      const result = await this.llm.invoke(formattedPrompt);

      return result.content || result.text;
    } catch (error) {
      debug('❌ Gap analysis error:', error.message);
      return 'Error analyzing research gaps';
    }
  }

  /**
   * Run Full RMRI Analysis using LangChain Agent
   */
  async runRMRIAnalysis(papers, query, config = {}) {
    await this.initialize();

    debug(`🚀 Starting LangChain RMRI analysis for: "${query}"`);
    debug(`📄 Analyzing ${papers.length} papers`);

    try {
      // Create agent
      const agent = await this.createResearchGapAgent(papers, query, config);

      // Run analysis
      const result = await agent.invoke({
        input: `Conduct a comprehensive research gap analysis for the query: "${query}". 

Use the available tools to:
1. Search for relevant content semantically
2. Identify methodologies used
3. Find research trends
4. Analyze research gaps

Provide a detailed report with specific, actionable research gaps and opportunities.`,
        query: query
      });

      return {
        success: true,
        analysis: result.output,
        metadata: {
          papersAnalyzed: papers.length,
          query: query,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      debug('❌ RMRI analysis error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a Summary Chain with Chat History
   * Note: In LangChain v1.0, use simple chat history array instead of BufferMemory
   */
  async createSummaryChain() {
    await this.initialize();

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'You are a research summarization expert.'],
      ['human', '{input}']
    ]);

    // Modern LangChain v1.0: Use pipe pattern
    const chain = prompt.pipe(this.llm);

    return chain;
  }
}

// Export singleton instance
module.exports = new LangChainRMRIService();
