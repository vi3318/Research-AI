const { supabase } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class ChatService {
  // Create a new chat session
  async createSession(userId, title, metadata = {}) {
    try {
      // Generate a unique title if not provided
      const sessionTitle = title || this.generateSessionTitle(metadata.query);
      
      console.log(`Creating session for user ${userId} with title: "${sessionTitle}"`);
      
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: userId,
          title: sessionTitle,
          metadata
        })
        .select()
        .single();

      if (error) {
        console.error('Database error in createSession:', error.message);
        console.log('Attempting fallback session creation...');
        // Return a mock session if database not ready, but log the issue
        const fallbackSession = {
          id: uuidv4(),
          user_id: userId,
          title: sessionTitle,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata
        };
        console.log('Created fallback session:', fallbackSession.id);
        return fallbackSession;
      }
      
      console.log('Successfully created session in database:', data.id);
      return data;
    } catch (error) {
      console.error('Database not ready in createSession:', error.message);
      // Return a mock session if database not ready
      const fallbackSession = {
        id: uuidv4(),
        user_id: userId,
        title: sessionTitle,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata
      };
      console.log('Created fallback session due to error:', fallbackSession.id);
      return fallbackSession;
    }
  }

  // Generate a unique session title based on query
  generateSessionTitle(query) {
    if (!query) {
      const topics = [
        'Machine Learning Research', 'AI Applications', 'Data Science Study',
        'Neural Networks Analysis', 'Computer Vision Project', 'NLP Research',
        'Deep Learning Investigation', 'Algorithm Development', 'Tech Innovation',
        'Research Exploration'
      ];
      return topics[Math.floor(Math.random() * topics.length)];
    }

    // Clean up the query and make it a nice title
    const cleanQuery = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter(word => word.length > 2)
      .slice(0, 4)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Return clean title without any JSON formatting or extra text
    return cleanQuery || 'Research Session';
  }

  // Get user's chat sessions
  async getUserSessions(userId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select(`
          id,
          title,
          created_at,
          updated_at,
          metadata,
          messages(count)
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Database error in getUserSessions:', error.message);
        return []; // Return empty array if database not ready
      }
      return data || [];
    } catch (error) {
      console.error('Database not ready in getUserSessions:', error.message);
      return []; // Return empty array if database not ready
    }
  }

  // Get session by ID
  async getSession(sessionId, userId) {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Database error in getSession:', error.message);
        return null; // Return null instead of throwing
      }
      return data;
    } catch (error) {
      console.error('Database not ready in getSession:', error.message);
      return null; // Return null if database not ready
    }
  }

  // Add message to session
  async addMessage(sessionId, role, content, metadata = {}) {
    try {
      // Update session timestamp
      await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          session_id: sessionId,
          role,
          content,
          metadata
        })
        .select()
        .single();

      if (error) {
        console.error('Database error in addMessage:', error.message);
        // Return mock message if database fails
        return {
          id: `temp-msg-${Date.now()}`,
          session_id: sessionId,
          role,
          content,
          metadata,
          created_at: new Date().toISOString()
        };
      }
      return data;
    } catch (error) {
      console.error('Database not ready in addMessage:', error.message);
      // Return mock message if database not ready
      return {
        id: `temp-msg-${Date.now()}`,
        session_id: sessionId,
        role,
        content,
        metadata,
        created_at: new Date().toISOString()
      };
    }
  }

  // Get session messages
  async getSessionMessages(sessionId, userId) {
    try {
      // Verify user owns the session
      const session = await this.getSession(sessionId, userId);
      if (!session) {
        console.error('Session not found for user:', userId, 'sessionId:', sessionId);
        return []; // Return empty array instead of throwing
      }

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Database error in getSessionMessages:', error.message);
        return []; // Return empty array if database fails
      }
      return data || [];
    } catch (error) {
      console.error('Database not ready in getSessionMessages:', error.message);
      return []; // Return empty array if database not ready
    }
  }

  // Add paper context to session
  async addPaperContext(sessionId, paperId, title, authors, abstract, content = '', metadata = {}) {
    try {
      // First try to find existing record (without .single() to avoid errors)
      const { data: existingRecords, error: searchError } = await supabase
        .from('paper_context')
        .select('id')
        .eq('session_id', sessionId)
        .eq('paper_id', paperId);

      if (searchError) {
        console.error('Error searching for existing paper context:', searchError.message);
      }

      const existing = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null;
      let data, error;
      
      if (existing) {
        // Update existing record
        ({ data, error } = await supabase
          .from('paper_context')
          .update({
            title,
            authors,
            abstract,
            content,
            metadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select());
          
        // Get the first record from the update result
        data = data && data.length > 0 ? data[0] : null;
      } else {
        // Insert new record
        ({ data, error } = await supabase
          .from('paper_context')
          .insert({
            session_id: sessionId,
            paper_id: paperId,
            title,
            authors,
            abstract,
            content,
            metadata
          })
          .select()
          .single());
      }

      if (error) {
        console.error('Database error in addPaperContext:', error.message);
        // Return mock context if database fails
        return {
          id: `temp-context-${Date.now()}`,
          session_id: sessionId,
          paper_id: paperId,
          title,
          authors,
          abstract,
          content,
          metadata,
          created_at: new Date().toISOString()
        };
      }
      return data;
    } catch (error) {
      console.error('Database not ready in addPaperContext:', error.message);
      // Return mock context if database not ready
      return {
        id: `temp-context-${Date.now()}`,
        session_id: sessionId,
        paper_id: paperId,
        title,
        authors,
        abstract,
        content,
        metadata,
        created_at: new Date().toISOString()
      };
    }
  }

  // Get session paper context
  async getSessionContext(sessionId, userId) {
    try {
      // Verify user owns the session
      const session = await this.getSession(sessionId, userId);
      if (!session) throw new Error('Session not found');

      const { data, error } = await supabase
        .from('paper_context')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error in getSessionContext:', error.message);
        return []; // Return empty array if database fails
      }
      
      return data || [];
    } catch (error) {
      console.error('Database not ready in getSessionContext:', error.message);
      return []; // Return empty array if database not ready
    }
  }

  // Update session title
  async updateSessionTitle(sessionId, userId, title) {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .update({ 
          title,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('Database error in updateSessionTitle:', error.message);
        return null;
      }

      // Return the first row if available (Supabase update returns array)
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error updating session title:', error.message);
      return null;
    }
  }

  // Delete session
  async deleteSession(sessionId, userId) {
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  // Store research job with session
  async storeResearchJob(userId, sessionId, jobId, query) {
    const { data, error } = await supabase
      .from('research_jobs')
      .insert({
        user_id: userId,
        session_id: sessionId,
        job_id: jobId,
        query,
        status: 'queued'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update research job
  async updateResearchJob(jobId, updates) {
    const { data, error } = await supabase
      .from('research_jobs')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get research job
  async getResearchJob(jobId, userId) {
    const { data, error } = await supabase
      .from('research_jobs')
      .select('*')
      .eq('job_id', jobId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = new ChatService();