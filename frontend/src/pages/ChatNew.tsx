import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import ReactMarkdown from 'react-markdown'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { apiClient } from '../lib/apiClient'
import { Loader2, Plus, MessageSquare, User, Bot, Trash2, Edit2, Check, X } from 'lucide-react'

interface ChatSession {
  id: string
  title: string
  created_at: string
  updated_at: string
  metadata?: any
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: any
  created_at: string
}

export default function Chat() {
  const { user, session } = useAuth()
  const [sessions, setSessions] = useLocalStorage<ChatSession[]>('chat-sessions', [])
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useLocalStorage<Message[]>('chat-messages', [])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load sessions when user is authenticated
  useEffect(() => {
    if (user && session) {
      loadSessions()
    }
  }, [user, session])

  // Load messages when active session changes
  useEffect(() => {
    if (activeSession) {
      loadSessionMessages(activeSession.id)
    }
  }, [activeSession])

  const loadSessions = async () => {
    try {
      setLoadingSessions(true)
      const data = await apiClient.getChatSessions()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Failed to load sessions:', error)
      // Use cached sessions if API fails
    } finally {
      setLoadingSessions(false)
    }
  }

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const data = await apiClient.getChatMessages(sessionId)
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Failed to load messages:', error)
      // Use cached messages if API fails
    }
  }

  const createNewSession = async () => {
    try {
      // Try to create on server first (only if authenticated)
      if (user && session) {
        try {
          const serverSession = await apiClient.createChatSession('New Research Session')
          if (serverSession.session) {
            setSessions(prev => [serverSession.session, ...prev])
            setActiveSession(serverSession.session)
            setMessages([])
            return
          }
        } catch (error) {
          console.log('Server session creation failed, using local session:', error)
        }
      }
      
      // Fallback to local session with proper UUID (mark as local)
      const sessionTitle = user ? 'New Research Session (Local)' : 'Local Chat Session (Login Required)'
      const newSession = {
        id: `local-${crypto.randomUUID()}`,
        title: sessionTitle,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      setSessions(prev => [newSession, ...prev])
      setActiveSession(newSession)
      setMessages([])
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  const handleSelectSession = (session: ChatSession) => {
    setActiveSession(session)
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || loading) return
    
    console.log('🚀 Sending message:', { 
      message: newMessage.trim(), 
      user: !!user, 
      session: !!session, 
      activeSession: activeSession?.id 
    })

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: newMessage.trim(),
      created_at: new Date().toISOString()
    }

    // Add user message immediately
    setMessages(prev => [...prev, userMessage])
    setNewMessage('')
    setLoading(true)

    try {
      // Try to send to server
      if (activeSession && user && session) {
        try {
          // Check if session exists on server first, if not create it
          if (activeSession.id.startsWith('local-') || activeSession.id.length < 10) {
            console.log('Creating session on server for local session...')
            const serverSession = await apiClient.createChatSession(activeSession.title || 'New Research Session')
            if (serverSession.session) {
              // Replace the local session with server session
              const newSession = serverSession.session
              setActiveSession(newSession)
              setSessions(prev => prev.map(s => s.id === activeSession.id ? newSession : s))
              // Now send the message with the new session ID
              const response = await apiClient.sendChatMessage(newSession.id, userMessage.content)
              if (response.message) {
                setMessages(prev => [...prev, response.message])
              }
            }
          } else {
            // Session should exist on server, try to send message
            const response = await apiClient.sendChatMessage(activeSession.id, userMessage.content)
            if (response.message) {
              setMessages(prev => [...prev, response.message])
            }
          }
        } catch (error) {
          console.error('Chat API error:', error)
          // Show specific error message based on error type
          let errorMessage = "I'm experiencing connection issues right now. Please try again in a moment."
          
          if (error instanceof Error) {
            if (error.message.includes('Authentication') || error.message.includes('Unauthorized')) {
              errorMessage = "🔒 Authentication required. Please log in again to continue chatting."
            } else if (error.message.includes('404') || error.message.includes('Not Found')) {
              errorMessage = "⚠️ Chat service temporarily unavailable. Please refresh the page and try again."
            } else {
              console.log('Detailed error info:', {
                message: error.message,
                status: (error as any).status,
                statusText: (error as any).statusText
              })
              errorMessage = `❌ ${error.message}`
            }
          }
          
          const aiMessage: Message = {
            id: `msg_${Date.now()}_ai`,
            role: 'assistant',
            content: errorMessage,
            created_at: new Date().toISOString()
          }
          setMessages(prev => [...prev, aiMessage])
        }
      } else {
        // User not authenticated or no session - provide local response
        const aiMessage: Message = {
          id: `msg_${Date.now()}_ai`,
          role: 'assistant',
          content: user 
            ? "🔒 Please create a research session first to start chatting."
            : "🔒 Please log in to use the chat feature with AI assistance.",
          created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, aiMessage])
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      // Show error message to user
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: `❌ **Message failed to send**\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or check your connection.`,
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      // Try to delete on server
      try {
        await apiClient.delete(`/chat/sessions/${sessionId}`)
      } catch (error) {
        console.error('Failed to delete session on server:', error)
      }
      
      // Remove from local state regardless
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (activeSession?.id === sessionId) {
        setActiveSession(null)
        setMessages([])
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  const handleUpdateSessionTitle = async (sessionId: string, newTitle: string) => {
    try {
      // Update locally first
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, title: newTitle, updated_at: new Date().toISOString() } : s
      ))
      
      // Try to update on server
      try {
        await apiClient.put(`/chat/sessions/${sessionId}`, { title: newTitle })
      } catch (error) {
        console.error('Failed to update session on server:', error)
      }
      
      setEditingSessionId(null)
      setEditingTitle('')
    } catch (error) {
      console.error('Failed to update session:', error)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Research Chat</h2>
          <p className="text-gray-600 mb-6">Sign in to start your research conversations</p>
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={createNewSession}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {loadingSessions ? (
            <div className="p-4 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : (
            <div className="p-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-3 rounded-lg mb-2 cursor-pointer transition-colors group ${
                    activeSession?.id === session.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleSelectSession(session)}
                >
                  <div className="flex items-center justify-between">
                    {editingSessionId === session.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateSessionTitle(session.id, editingTitle)
                            } else if (e.key === 'Escape') {
                              setEditingSessionId(null)
                              setEditingTitle('')
                            }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUpdateSessionTitle(session.id, editingTitle)
                          }}
                          className="p-1 text-green-600 hover:text-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingSessionId(null)
                            setEditingTitle('')
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {session.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(session.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingSessionId(session.id)
                              setEditingTitle(session.title)
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteSession(session.id)
                            }}
                            className="p-1 text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeSession ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-200">
              <h1 className="text-xl font-semibold text-gray-900">
                {activeSession.title}
              </h1>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Bot className="h-5 w-5 text-blue-600" />
                      </div>
                    )}
                    
                    <div
                      className={`max-w-2xl px-4 py-2 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <ReactMarkdown className="prose prose-sm max-w-none">
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>

                    {message.role === 'user' && (
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-600" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 justify-start"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Bot className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="bg-white border border-gray-200 px-4 py-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-gray-600">Thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="Ask about your research..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled={loading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Select a chat or start a new one
              </h2>
              <p className="text-gray-600">
                Choose from your previous conversations or create a new research session
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
