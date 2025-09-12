import { supabase } from '../lib/supabase';

// API utility that automatically includes authentication headers
class ApiClient {
  private baseURL: string;

  constructor(baseURL?: string) {
    // Use environment variable or fallback to relative path for Vite proxy
    this.baseURL = baseURL || (import.meta as any).env?.VITE_API_BASE_URL || '/api';
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    return headers;
  }

  async get(endpoint: string, options: RequestInit = {}) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers: {
        ...headers,
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      }
      if (response.status === 429) {
        throw new Error('Too many requests. Please wait a moment before trying again.');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async post(endpoint: string, data?: any, options: RequestInit = {}) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        ...headers,
        ...options.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      }
      if (response.status === 429) {
        throw new Error('Too many requests. Please wait a moment before trying again.');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async put(endpoint: string, data?: any, options: RequestInit = {}) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: {
        ...headers,
        ...options.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      }
      if (response.status === 429) {
        throw new Error('Too many requests. Please wait a moment before trying again.');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async delete(endpoint: string, options: RequestInit = {}) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        ...headers,
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      }
      if (response.status === 429) {
        throw new Error('Too many requests. Please wait a moment before trying again.');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async postFormData(endpoint: string, formData: FormData, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        ...headers,
        ...options.headers,
      },
      body: formData,
      ...options,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      }
      if (response.status === 429) {
        throw new Error('Too many requests. Please wait a moment before trying again.');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Specific methods for common API calls
  async getChatSessions() {
    return this.get('/chat/sessions');
  }

  async createChatSession(title?: string, metadata?: any) {
    return this.post('/chat/sessions', { title, metadata });
  }

  async getChatMessages(sessionId: string) {
    return this.get(`/chat/sessions/${sessionId}/messages`);
  }

  async sendChatMessage(sessionId: string, content: string, metadata?: any) {
    return this.post(`/chat/sessions/${sessionId}/messages`, { message: content, ...metadata });
  }

  async getWorkspaces() {
    return this.get('/workspaces');
  }

  async createWorkspace(name: string, description?: string) {
    return this.post('/workspaces', { name, description });
  }

  async getWorkspaceMembers(workspaceId: string) {
    return this.get(`/workspaces/${workspaceId}/members`);
  }

  async searchLiterature(topic: string, sources?: string[], maxResults?: number) {
    const params = new URLSearchParams({
      topic,
      ...(sources && { sources: sources.join(',') }),
      ...(maxResults && { maxResults: maxResults.toString() }),
    });
    return this.get(`/literature/search?${params}`);
  }

  async generateCitations(paperData: any) {
    try {
      const response = await this.post('/citations/generate-all', { paperData });
      return response;
    } catch (error) {
      console.error('Citation generation error:', error);
      throw error;
    }
  }

  // Additional chat session methods
  async updateSession(sessionId: string, data: any) {
    return this.put(`/chat/sessions/${sessionId}`, data);
  }

  async deleteSession(sessionId: string) {
    return this.delete(`/chat/sessions/${sessionId}`);
  }

  async getSessionMessages(sessionId: string) {
    return this.get(`/chat/sessions/${sessionId}/messages`);
  }

  async sendMessage(sessionId: string, message: string, context?: any) {
    return this.post(`/chat/sessions/${sessionId}/messages`, { content: message, context });
  }

  async getSessionContext(sessionId: string) {
    return this.get(`/chat/sessions/${sessionId}/context`);
  }

  async addPapersToContext(sessionId: string, papers: any[]) {
    return this.post(`/chat/sessions/${sessionId}/context`, { papers });
  }

  // Research methods
  async searchResearch(query: string, options?: any) {
    return this.post('/research/search', { query, ...options });
  }

  async enhancedResearchChat(sessionId: string, message: string, context?: any) {
    return this.post('/enhanced-research/chat', { 
      sessionId, 
      message, 
      context 
    });
  }

  async analyzePaper(paper: any, sessionId?: string) {
    return this.post('/research/analyze-paper', { paper, sessionId });
  }

  async generateVisualization(sessionId: string, visualizationType: string = 'comprehensive') {
    return this.post('/enhanced-research/gap-visualization', { sessionId, visualizationType });
  }

  async generateHypotheses(sessionId: string, researchArea: string) {
    return this.post('/enhanced-research/generate-hypotheses', { sessionId, researchArea });
  }

  async generatePresentation(paper: any, options?: any) {
    return this.post('/research/generate-presentation', { paper, ...options });
  }

  async exportPresentationToMarkdown(presentation: any) {
    return this.post('/research/export-presentation-markdown', { presentation });
  }

  // Cerebras Research Assistant
  async researchAssistant(message: string, sessionId?: string, researchArea?: string) {
    return this.post('/chat/research-assistant', { 
      message, 
      sessionId, 
      researchArea 
    });
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();

// Export the class for custom instances if needed
export { ApiClient };
