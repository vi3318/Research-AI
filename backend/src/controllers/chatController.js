const chatService = require('../services/chatService');
const geminiService = require('../services/geminiService');
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
      const userId = req.auth.userId;
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
        userMessage,
        assistantMessage,
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
      const response = await geminiService.generateText(prompt);
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
      const response = await geminiService.generateText(prompt);
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
      const response = await geminiService.generateText(prompt);
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
          paper.doi || paper.url || paper.title,
          paper.title,
          paper.authors,
          paper.abstract,
          content,
          { source: paper.source, citationCount: paper.citationCount }
        );

        addedPapers.push(contextPaper);
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

      const session = await chatService.updateSessionTitle(sessionId, userId, title);
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
}

module.exports = new ChatController();