import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: any;
  created_at: string;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  messages?: Message[];
}

interface ChatContextType {
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  messages: Message[];
  addSession: (session: ChatSession) => void;
  setActiveSession: (session: ChatSession | null) => void;
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => void;
  deleteSession: (sessionId: string) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
  loadMessages: (messages: Message[]) => void;
  getSessionById: (sessionId: string) => ChatSession | undefined;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [sessions, setSessions] = useLocalStorage<ChatSession[]>('chat-sessions', []);
  const [activeSessionId, setActiveSessionId] = useLocalStorage<string | null>('active-session-id', null);
  const [messages, setMessages] = useLocalStorage<Message[]>('chat-messages', []);
  const [activeSession, setActiveSessionState] = useState<ChatSession | null>(null);

  // Load active session from localStorage on mount
  useEffect(() => {
    if (activeSessionId) {
      const session = sessions.find(s => s.id === activeSessionId);
      if (session) {
        setActiveSessionState(session);
        // Load messages for this session
        const sessionMessages = localStorage.getItem(`chat-messages-${activeSessionId}`);
        if (sessionMessages) {
          try {
            setMessages(JSON.parse(sessionMessages));
          } catch (error) {
            console.error('Failed to load messages for session:', error);
          }
        }
      }
    }
  }, [activeSessionId, sessions]);

  const addSession = (session: ChatSession) => {
    setSessions(prev => {
      const exists = prev.find(s => s.id === session.id);
      if (exists) {
        return prev.map(s => s.id === session.id ? { ...session } : s);
      }
      return [session, ...prev];
    });
  };

  const setActiveSession = (session: ChatSession | null) => {
    // Save current messages to the previous session
    if (activeSession && messages.length > 0) {
      localStorage.setItem(`chat-messages-${activeSession.id}`, JSON.stringify(messages));
    }

    setActiveSessionState(session);
    setActiveSessionId(session?.id || null);
    
    if (session) {
      // Load messages for the new session
      const sessionMessages = localStorage.getItem(`chat-messages-${session.id}`);
      if (sessionMessages) {
        try {
          setMessages(JSON.parse(sessionMessages));
        } catch (error) {
          console.error('Failed to load messages for session:', error);
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  };

  const updateSession = (sessionId: string, updates: Partial<ChatSession>) => {
    setSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? { ...session, ...updates, updated_at: new Date().toISOString() }
        : session
    ));
    
    // Update active session if it's the same
    if (activeSession?.id === sessionId) {
      setActiveSessionState(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const deleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    
    // Clear messages for this session
    localStorage.removeItem(`chat-messages-${sessionId}`);
    
    // If this was the active session, clear it
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
    }
  };

  const addMessage = (message: Message) => {
    setMessages(prev => {
      const newMessages = [...prev, message];
      // Auto-save messages to session-specific storage
      if (activeSession) {
        localStorage.setItem(`chat-messages-${activeSession.id}`, JSON.stringify(newMessages));
      }
      return newMessages;
    });
  };

  const updateMessage = (messageId: string, updates: Partial<Message>) => {
    setMessages(prev => {
      const newMessages = prev.map(msg => 
        msg.id === messageId ? { ...msg, ...updates } : msg
      );
      // Auto-save messages to session-specific storage
      if (activeSession) {
        localStorage.setItem(`chat-messages-${activeSession.id}`, JSON.stringify(newMessages));
      }
      return newMessages;
    });
  };

  const clearMessages = () => {
    setMessages([]);
    // Clear from session-specific storage
    if (activeSession) {
      localStorage.removeItem(`chat-messages-${activeSession.id}`);
    }
  };

  const loadMessages = (newMessages: Message[]) => {
    setMessages(newMessages);
    // Auto-save messages to session-specific storage
    if (activeSession) {
      localStorage.setItem(`chat-messages-${activeSession.id}`, JSON.stringify(newMessages));
    }
  };

  const getSessionById = (sessionId: string) => {
    return sessions.find(s => s.id === sessionId);
  };

  const value = {
    sessions,
    activeSession,
    messages,
    addSession,
    setActiveSession,
    updateSession,
    deleteSession,
    addMessage,
    updateMessage,
    clearMessages,
    loadMessages,
    getSessionById,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
