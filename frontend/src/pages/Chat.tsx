import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser, SignInButton, UserButton, useAuth } from '@clerk/clerk-react'
import ReactMarkdown from 'react-markdown'
import {
  getChatSessions,
  createChatSession,
  getSessionMessages,
  sendMessage,
  addPapersToContext,
  getSessionContext,
  updateSession,
  deleteSession,
  setAuthToken
} from '../lib/api'

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

interface PaperContext {
  id: string
  paper_id: string
  title: string
  authors: string
  abstract: string
  metadata?: any
}

export default function Chat() {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionContext, setSessionContext] = useState<PaperContext[]>([])
  const [messageType, setMessageType] = useState<'chat' | 'research' | 'paper_qa'>('chat')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Set up auth token when user changes
  useEffect(() => {
    if (isLoaded && user) {
      getToken().then(token => {
        setAuthToken(token)
        loadSessions()
      })
    } else if (isLoaded && !user) {
      setAuthToken(null)
      setSessions([])
      setActiveSession(null)
      setMessages([])
    }
  }, [user, isLoaded])

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load session context when active session changes
  useEffect(() => {
    if (activeSession && user) {
      loadSessionContext()
    }
  }, [activeSession])

  const loadSessions = async () => {
    try {
      const data = await getChatSessions()
      setSessions(data)
    } catch (error) {
      console.error('Error loading sessions:', error)
    }
  }

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const data = await getSessionMessages(sessionId)
      setMessages(data)
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const loadSessionContext = async () => {
    if (!activeSession) return
    try {
      const data = await getSessionContext(activeSession.id)
      setSessionContext(data)
    } catch (error) {
      console.error('Error loading session context:', error)
    }
  }

  const handleCreateSession = async () => {
    try {
      const session = await createChatSession('New Research Session')
      setSessions(prev => [session, ...prev])
      setActiveSession(session)
      setMessages([])
    } catch (error) {
      console.error('Error creating session:', error)
    }
  }

  const handleSelectSession = async (session: ChatSession) => {
    setActiveSession(session)
    await loadSessionMessages(session.id)
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeSession || loading) return

    setLoading(true)
    try {
      const response = await sendMessage(activeSession.id, newMessage.trim(), messageType)
      setMessages(prev => [...prev, response.userMessage, response.assistantMessage])
      setNewMessage('')
      
      // Update session timestamp
      setSessions(prev => prev.map(s => 
        s.id === activeSession.id 
          ? { ...s, updated_at: response.session.updated_at }
          : s
      ))
    } catch (error) {
      console.error('Error sending message:', error)
    }
    setLoading(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleUpdateSessionTitle = async (sessionId: string, newTitle: string) => {
    try {
      await updateSession(sessionId, newTitle)
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, title: newTitle } : s
      ))
      if (activeSession?.id === sessionId) {
        setActiveSession(prev => prev ? { ...prev, title: newTitle } : null)
      }
    } catch (error) {
      console.error('Error updating session title:', error)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (activeSession?.id === sessionId) {
        setActiveSession(null)
        setMessages([])
      }
    } catch (error) {
      console.error('Error deleting session:', error)
    }
  }

  if (!isLoaded) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <h2 className="text-xl font-semibold">Sign in to start chatting</h2>
        <p className="text-slate-400 text-center">
          Create an account to save your research sessions and chat with AI about papers
        </p>
        <SignInButton mode="modal">
          <button className="btn">Sign In</button>
        </SignInButton>
      </div>
    )
  }

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div className="w-80 bg-slate-900/50 border-r border-white/10 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-semibold">Chat Sessions</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleCreateSession} className="btn-sm">New</button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto">
          {sessions.map((session) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-3 border-b border-white/5 cursor-pointer hover:bg-white/5 ${
                activeSession?.id === session.id ? 'bg-brand-500/20' : ''
              }`}
              onClick={() => handleSelectSession(session)}
            >
              <div className="font-medium text-sm truncate">{session.title}</div>
              <div className="text-xs text-slate-400 mt-1">
                {new Date(session.updated_at).toLocaleDateString()}
              </div>
              <div className="flex gap-1 mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const newTitle = prompt('Enter new title:', session.title)
                    if (newTitle) handleUpdateSessionTitle(session.id, newTitle)
                  }}
                  className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded"
                >
                  Rename
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('Delete this session?')) handleDeleteSession(session.id)
                  }}
                  className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {activeSession ? (
          <>
            {/* Chat header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{activeSession.title}</h3>
                <div className="text-sm text-slate-400 flex gap-4 mt-1">
                  <span>{sessionContext.length} papers in context</span>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="messageType"
                        value="chat"
                        checked={messageType === 'chat'}
                        onChange={(e) => setMessageType(e.target.value as any)}
                      />
                      <span className="text-xs">Chat</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="messageType"
                        value="research"
                        checked={messageType === 'research'}
                        onChange={(e) => setMessageType(e.target.value as any)}
                      />
                      <span className="text-xs">Research</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="messageType"
                        value="paper_qa"
                        checked={messageType === 'paper_qa'}
                        onChange={(e) => setMessageType(e.target.value as any)}
                      />
                      <span className="text-xs">Paper Q&A</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-2xl p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-brand-500 text-white'
                          : 'bg-slate-800 text-slate-100'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <ReactMarkdown className="prose prose-invert max-w-none">
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                      <div className="text-xs opacity-70 mt-2">
                        {new Date(message.created_at).toLocaleTimeString()}
                        {message.metadata?.type && (
                          <span className="ml-2 px-1 py-0.5 bg-black/20 rounded text-xs">
                            {message.metadata.type}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-3">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    messageType === 'paper_qa'
                      ? 'Ask a question about the papers in this session...'
                      : messageType === 'research'
                      ? 'Ask a research-related question...'
                      : 'Type your message...'
                  }
                  className="flex-1 p-3 rounded-lg bg-slate-800 border border-white/10 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  rows={3}
                  disabled={loading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || loading}
                  className="btn self-end"
                >
                  {loading ? 'Sending...' : 'Send'}
                </button>
              </div>
              {messageType === 'paper_qa' && sessionContext.length === 0 && (
                <p className="text-xs text-yellow-400 mt-2">
                  No papers in context. Run a research query first to add papers.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Welcome to Research Chat</h3>
              <p className="text-slate-400 mb-4">
                Select a session from the sidebar or create a new one to start chatting
              </p>
              <button onClick={handleCreateSession} className="btn">
                Start New Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}