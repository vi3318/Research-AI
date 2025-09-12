const chatService = require('../services/chatService');
const cerebrasService = require('../services/cerebrasService');
const pdfProcessorService = require('../services/pdfProcessorService');
const { vectorStore } = require('../services/vectorStoreService');
const embeddingsService = require('../services/embeddingsService');

class ChatController {
  // Create new chat session
  async createSession(req, res) {
    try {
      const { title, metadata } = req.body;
      const userId = req.auth.userId;

      const session = await chatService.createSession(userId, title, metadata);
      res.json(session);
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  }

  // Get user sessions
  async getSessions(req, res) {
    try {
      const userId = req.auth?.userId;
      
      if (!userId) {
        return res.json({ success: true, data: [] }); // Return empty array if no user
      }
      
      const sessions = await chatService.getUserSessions(userId);
      res.json(sessions);
    } catch (error) {
      console.error('Error getting sessions:', error);
      res.status(500).json({ error: 'Failed to get sessions' });
    }
  }

  // Get session messages
  async getSessionMessages(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.auth.userId;

      const messages = await chatService.getSessionMessages(sessionId, userId);
      res.json(messages);
    } catch (error) {
      console.error('Error getting messages:', error);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  }

  // Send message and get AI response
  async sendMessage(req, res) {
    try {
      const { sessionId } = req.params;
      const { message, type = 'chat' } = req.body; // type: 'chat' | 'research' | 'paper_qa'
      const userId = req.auth.userId;

      // Verify session ownership
      const session = await chatService.getSession(sessionId, userId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Add user message
      const userMessage = await chatService.addMessage(sessionId, 'user', message, { type });

      let aiResponse = '';
      let metadata = {};

      if (type === 'paper_qa') {
        // Q&A based on papers in session context
        const context = await chatService.getSessionContext(sessionId, userId);
        aiResponse = await this.handlePaperQA(message, context);
        metadata = { type: 'paper_qa', context_papers: context.length };
      } else if (type === 'research') {
        // Research-oriented chat
        aiResponse = await this.handleResearchChat(message, sessionId, userId);
        metadata = { type: 'research' };
      } else {
        // General chat
        const recentMessages = await chatService.getSessionMessages(sessionId, userId);
        aiResponse = await this.handleGeneralChat(message, recentMessages.slice(-10)); // Last 10 messages for context
        metadata = { type: 'chat' };
      }

      // Add AI response
      const assistantMessage = await chatService.addMessage(sessionId, 'assistant', aiResponse, metadata);

      res.json({
        success: true,
        message: assistantMessage,
        userMessage,
        session: session
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  // Handle paper-specific Q&A
  async handlePaperQA(question, context) {
    if (!context || context.length === 0) {
      return "I don't have any papers in context for this session. Please add some papers first by running a research query.";
    }

    // Create context string from papers
    const contextText = context.map(paper => 
      `Title: ${paper.title}\nAuthors: ${paper.authors}\nAbstract: ${paper.abstract}\nContent: ${paper.content.substring(0, 2000)}...`
    ).join('\n\n---\n\n');

    const prompt = `Based on the following research papers, please answer the question: "${question}"

Research Papers Context:
${contextText}

Please provide a detailed answer based on the papers above, citing specific papers when relevant.`;

    try {
      const response = await cerebrasService.generatePaperAnalysis(question, context, {
        maxTokens: 6000,
        temperature: 0.6
      });
      return response;
    } catch (error) {
      console.error('Error in paper Q&A:', error);
      return "I'm sorry, I encountered an error while analyzing the papers. Please try again.";
    }
  }

  // Handle research-oriented chat
  async handleResearchChat(message, sessionId, userId) {
    // Get recent messages for context
    const recentMessages = await chatService.getSessionMessages(sessionId, userId);
    const context = recentMessages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');

    const prompt = `You are a research assistant helping with academic research. Here's the conversation context:

${context}

User: ${message}

Please provide a helpful response focused on research methodology, paper analysis, or research guidance. If the user is asking about specific papers or research topics, provide detailed academic insights.`;

    try {
      const response = await cerebrasService.generateResearchResponse(message, {
        maxTokens: 5000,
        temperature: 0.7
      });
      return response;
    } catch (error) {
      console.error('Error in research chat:', error);
      return "I'm sorry, I encountered an error. Please try again.";
    }
  }

  // Handle general chat
  async handleGeneralChat(message, recentMessages) {
    const context = recentMessages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');

    const prompt = `You are a helpful research assistant. Here's the conversation context:

${context}

User: ${message}

Please provide a helpful response.`;

    try {
      const response = await cerebrasService.generateText(message, {
        maxTokens: 4000,
        temperature: 0.8
      });
      return response;
    } catch (error) {
      console.error('Error in general chat:', error);
      return "I'm sorry, I encountered an error. Please try again.";
    }
  }

  // Add papers to session context
  async addPapersToContext(req, res) {
    try {
      const { sessionId } = req.params;
      const { papers } = req.body;
      const userId = req.auth.userId;

      console.log(`📚 Adding ${papers?.length || 0} papers to session context for session ${sessionId}`);

      // Verify session ownership
      const session = await chatService.getSession(sessionId, userId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const addedPapers = [];
      for (const paper of papers) {
        // Create a unique paper ID - use multiple sources for better matching
        const paperId = paper.doi || paper.url || paper.paper_id || paper.title;
        
        // Handle authors field (could be array or string)
        const authorsString = Array.isArray(paper.authors) 
          ? paper.authors.join(', ') 
          : (paper.authors || 'Unknown Author');

        // Try to get full PDF content if available
        let content = '';
        if (paper.pdfUrl) {
          try {
            const pdfData = await pdfProcessorService.processPDF(paper.pdfUrl);
            content = pdfData.text || '';
          } catch (error) {
            console.error('Error processing PDF:', error);
            content = paper.abstract || '';
          }
        } else {
          content = paper.abstract || '';
        }

        const contextPaper = await chatService.addPaperContext(
          sessionId,
          paperId,
          paper.title,
          authorsString,
          paper.abstract,
          content,
          { 
            source: paper.source, 
            citationCount: paper.citationCount,
            year: paper.year,
            publication: paper.publication,
            pdfUrl: paper.pdfUrl,
            doi: paper.doi,
            url: paper.url,
            paper_id: paper.paper_id // Store original paper_id as well
          }
        );

        addedPapers.push(contextPaper);
        console.log(`✅ Added paper to context: "${paper.title}" with ID: "${paperId}"`);
      }

      console.log(`✅ Successfully added ${addedPapers.length} papers to session context`);

      res.json({ 
        message: `Added ${addedPapers.length} papers to session context`,
        papers: addedPapers 
      });
    } catch (error) {
      console.error('Error adding papers to context:', error);
      res.status(500).json({ error: 'Failed to add papers to context' });
    }
  }

  // Get session context
  async getSessionContext(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.auth.userId;

      const context = await chatService.getSessionContext(sessionId, userId);
      res.json(context);
    } catch (error) {
      console.error('Error getting session context:', error);
      res.status(500).json({ error: 'Failed to get session context' });
    }
  }

  // Update session title
  async updateSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { title } = req.body;
      const userId = req.auth.userId;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const session = await chatService.updateSessionTitle(sessionId, userId, title);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found or update failed' });
      }
      
      res.json(session);
    } catch (error) {
      console.error('Error updating session:', error);
      res.status(500).json({ error: 'Failed to update session' });
    }
  }

  // Delete session
  async deleteSession(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.auth.userId;

      await chatService.deleteSession(sessionId, userId);
      res.json({ message: 'Session deleted successfully' });
    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({ error: 'Failed to delete session' });
    }
  }

  // Cerebras-powered research assistant
  async researchAssistant(req, res) {
    try {
      const { message, sessionId, researchArea } = req.body;
      const userId = req.auth?.userId;

      console.log('Research assistant request:', { message, sessionId, researchArea, userId });

      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Create enhanced research assistant prompt
      const systemPrompt = `You are an expert AI Research Assistant and Guide with deep knowledge across all academic disciplines. Your role is to:

🎯 **PRIMARY OBJECTIVES:**
- Guide researchers on any topic with authoritative, cutting-edge insights
- Analyze current research trends and identify emerging opportunities
- Explain complex concepts in an accessible, educational manner
- Provide actionable research directions and methodologies

📊 **RESEARCH EXPERTISE:**
- Stay current with latest developments across all fields
- Identify research gaps and novel approaches
- Suggest interdisciplinary connections and collaborations
- Recommend high-impact research directions

🧠 **TEACHING APPROACH:**
- Break down complex concepts into digestible explanations
- Provide real-world examples and applications
- Suggest learning resources and methodologies
- Encourage critical thinking and innovation

📈 **TREND ANALYSIS:**
- Highlight emerging research areas and hot topics
- Identify breakthrough technologies and methodologies
- Analyze publication patterns and citation trends
- Predict future research directions

🔬 **PRACTICAL GUIDANCE:**
- Recommend specific research methodologies
- Suggest relevant datasets, tools, and frameworks
- Provide citation recommendations and key papers
- Offer publication and funding strategies

**RESPONSE FORMAT:**
Structure your responses to include:
1. Direct answer to the question
2. Current trends and emerging opportunities
3. Key concepts explained simply
4. Actionable next steps
5. Relevant resources and recommendations

Always be encouraging, insightful, and forward-thinking. Help researchers push the boundaries of knowledge while building solid foundations.`;

      // Get session context if available
      let contextInfo = '';
      if (sessionId) {
        try {
          const context = await chatService.getSessionContext(sessionId, userId);
          if (context && context.length > 0) {
            const papers = context.map(p => `"${p.title}" by ${p.authors || 'Unknown'}`).join(', ');
            contextInfo = `\n\nCONTEXT: The user is working with these papers: ${papers}. Consider this research context when providing guidance.`;
          }
        } catch (err) {
          console.warn('Failed to get session context:', err.message);
        }
      }

      // Add research area context if provided
      if (researchArea) {
        contextInfo += `\n\nRESEARCH FOCUS: ${researchArea}`;
      }

      const enhancedPrompt = systemPrompt + contextInfo + `\n\nUSER QUESTION: ${message}`;

      // Get response from Cerebras
      const response = await cerebrasService.generateResearchResponse(enhancedPrompt, {
        maxTokens: 2000,
        temperature: 0.7,
        model: 'llama3.1-70b' // Use the more capable model for research assistance
      });

      // Save to session if sessionId provided
      if (sessionId) {
        try {
          // Add user message
          await chatService.addMessage(sessionId, 'user', message, {
            type: 'research_question',
            researchArea: researchArea || 'general'
          });

          // Add assistant response
          await chatService.addMessage(sessionId, 'assistant', response, {
            type: 'research_assistance',
            model: 'cerebras-llama3.1-70b',
            researchArea: researchArea || 'general'
          });
        } catch (err) {
          console.warn('Failed to save to session:', err.message);
        }
      }

      // Extract trends and suggestions from the response (basic parsing)
      const trends = [];
      const suggestions = [];
      
      // Simple pattern matching for trends
      const trendMatches = response.match(/(?:trending|emerging|hot topic|breakthrough|cutting-edge|novel|innovative)[^.!?]*[.!?]/gi);
      if (trendMatches) {
        trends.push(...trendMatches.slice(0, 3));
      }

      // Simple pattern matching for suggestions
      const suggestionMatches = response.match(/(?:recommend|suggest|consider|try|explore|investigate)[^.!?]*[.!?]/gi);
      if (suggestionMatches) {
        suggestions.push(...suggestionMatches.slice(0, 3));
      }

      res.json({
        success: true,
        response: response,
        trends: trends,
        suggestions: suggestions,
        metadata: {
          model: 'cerebras-llama3.1-70b',
          researchArea: researchArea || 'general',
          hasContext: !!contextInfo
        }
      });

    } catch (error) {
      console.error('Research assistant error:', error);
      res.status(500).json({ 
        error: 'Failed to generate research assistance',
        details: error.message 
      });
    }
  }
}

module.exports = new ChatController();