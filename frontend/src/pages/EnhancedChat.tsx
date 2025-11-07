import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { usePaperStorage } from '../contexts/PaperStorageContext'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import { 
  HiDotsVertical, HiPencil, HiTrash, HiSearch, HiSparkles, HiLightningBolt,
  HiDocumentText, HiChartBar, HiChatAlt2, HiX, HiPlus, HiArrowRight,
  HiBookOpen, HiAcademicCap, HiBeaker, HiLightBulb
} from 'react-icons/hi'
import { useTheme } from '../contexts/ThemeContext'
import ResearchGapVisualization from '../components/ResearchGapVisualization'
import CitationButton from '../components/CitationButton'
import ProtectedRoute from '../components/ProtectedRoute'
import { apiClient } from '../lib/apiClient'

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

interface Paper {
  title: string;
  authors: string[] | string;
  abstract: string;
  doi?: string;
  pdfUrl?: string;
  url?: string;
  source: string;
  citationCount?: number;
  relevanceScore?: number;
  paper_id?: string; 
  isOpenAccess?: boolean;
  oaHostType?: string;
  year?: number | string;
  publication?: string;
}

interface PaperContext {
  id: string
  paper_id: string
  title: string
  authors: string[] | string
  abstract: string
  content?: string
  metadata?: any
  source?: string;
}

export default function EnhancedChat() {
  const { user, loading: authLoading, getToken } = useAuth()
  const { theme, isDark } = useTheme()
  const { addPaper, addSearchResult, papers: savedPapers } = usePaperStorage()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [sessionContext, setSessionContext] = useState<PaperContext[]>([])
  const [searchResults, setSearchResults] = useState<Paper[]>([])
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)
  const [gapAnalysis, setGapAnalysis] = useState<any>(null)
  const [hypotheses, setHypotheses] = useState<any>(null)
  const [activeView, setActiveView] = useState<'chat' | 'papers' | 'analysis'>('chat')
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null)
  const [editingSession, setEditingSession] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [taggedPaper, setTaggedPaper] = useState<Paper | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [researchMode, setResearchMode] = useState<'simple' | 'max'>('simple')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Helper function to generate unique message IDs
  const generateMessageId = (role: string) => 
    `${role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // LocalStorage utilities for paper persistence
  const saveSearchResultsToStorage = (papers: Paper[], sessionId: string) => {
    try {
      const key = `searchResults_${sessionId}`
      localStorage.setItem(key, JSON.stringify(papers))
      console.log(`Saved ${papers.length} papers to localStorage for session ${sessionId}`)
      
      // Also save to our paper storage context
      const searchResult = {
        id: `search_${sessionId}_${Date.now()}`,
        query: `Session ${sessionId} search`,
        papers: papers.map(paper => ({
          id: paper.id || `paper_${Date.now()}_${Math.random()}`,
          title: paper.title || 'Untitled',
          authors: paper.authors || ['Unknown Author'],
          abstract: paper.abstract || '',
          url: paper.url,
          doi: paper.doi,
          venue: paper.venue,
          year: paper.year,
          citations: paper.citations,
          pdfUrl: paper.pdfUrl,
          metadata: paper,
          addedAt: new Date().toISOString()
        })),
        timestamp: new Date().toISOString(),
        totalResults: papers.length,
        source: 'enhanced-chat'
      }
      
      // Save papers individually and add search result
      searchResult.papers.forEach(paper => addPaper(paper))
      addSearchResult(searchResult)
    } catch (error) {
      console.warn('Failed to save papers to localStorage:', error)
    }
  }

  const loadSearchResultsFromStorage = (sessionId: string): Paper[] => {
    try {
      const key = `searchResults_${sessionId}`
      const stored = localStorage.getItem(key)
      if (stored) {
        const papers = JSON.parse(stored)
        console.log(`Loaded ${papers.length} papers from localStorage for session ${sessionId}`)
        return papers
      }
    } catch (error) {
      console.warn('Failed to load papers from localStorage:', error)
    }
    return []
  }

  const clearStoredSearchResults = (sessionId: string) => {
    try {
      const key = `searchResults_${sessionId}`
      localStorage.removeItem(key)
    } catch (error) {
      console.warn('Failed to clear stored papers:', error)
    }
  }

  // Responsive detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      setSidebarCollapsed(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Set up auth and load sessions when user is available
  useEffect(() => {
    if (user) {
      console.log('User authenticated, loading sessions')
      loadSessions()
    } else {
      setSessions([])
      setActiveSession(null)
      setMessages([])
      localStorage.removeItem('lastActiveSessionId')
      localStorage.removeItem('lastActiveView')
    }
  }, [user])

  // Restore last active session when sessions are loaded
  useEffect(() => {
    if (sessions.length > 0 && user && !activeSession) {
      restoreLastActiveSession()
    }
  }, [sessions, user, activeSession])

  // Restore last active session from localStorage
  const restoreLastActiveSession = () => {
    try {
      const lastSessionId = localStorage.getItem('lastActiveSessionId')
      const lastActiveView = localStorage.getItem('lastActiveView') as 'chat' | 'papers' | 'analysis'
      
      if (lastSessionId && sessions.length > 0) {
        const lastSession = sessions.find(s => s.id === lastSessionId)
        if (lastSession) {
          setActiveSession(lastSession)
          if (lastActiveView) {
            setActiveView(lastActiveView)
          }
          console.log(`Restored last active session: ${lastSession.title}`)
        }
      } else if (sessions.length > 0) {
        // If no last session, select the most recent one
        setActiveSession(sessions[0])
      }
    } catch (error) {
      console.error('Error restoring last active session:', error)
    }
  }

  // Save active session to localStorage when it changes
  useEffect(() => {
    if (activeSession) {
      localStorage.setItem('lastActiveSessionId', activeSession.id)
    }
  }, [activeSession])

  // Save active view to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('lastActiveView', activeView)
  }, [activeView])

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load session context when active session changes
  useEffect(() => {
    if (activeSession && user && !isSearching) {
      // Only load session data if we're not currently searching
      // This prevents clearing messages during active search operations
      loadSessionContext()
      loadSessionMessages(activeSession.id)
    }
  }, [activeSession])

  // Restore papers when switching to papers view or when session loads
  useEffect(() => {
    if (activeView === 'papers' && activeSession && searchResults.length === 0) {
      // Check if papers exist in PaperStorageContext first
      if (savedPapers.length > 0) {
        console.log(`Using ${savedPapers.length} papers from PaperStorageContext`)
        setSearchResults(savedPapers)
        
        // Sync to backend session context for RAG analysis
        apiClient.addPapersToContext(activeSession.id, savedPapers)
          .then(() => {
            console.log(`Synced ${savedPapers.length} papers to backend session context`)
          })
          .catch(err => console.error('Error syncing papers to backend:', err))
        return
      }
      
      // Fallback: Try localStorage (faster)
      const storedPapers = loadSearchResultsFromStorage(activeSession.id)
      if (storedPapers.length > 0) {
        setSearchResults(storedPapers)
        console.log(`Restored ${storedPapers.length} papers from localStorage`)
        
        // Also ensure papers are in backend session context for RAG analysis
        apiClient.addPapersToContext(activeSession.id, storedPapers)
          .then(() => {
            console.log(`Synced ${storedPapers.length} papers to backend session context`)
          })
          .catch(error => {
            console.error('Failed to sync papers to backend session context:', error)
          })
        return
      }

      // Fallback to session context
      if (sessionContext.length > 0) {
        const restoredPapers: Paper[] = sessionContext.map(context => ({
          title: context.title,
          authors: context.authors,
          abstract: context.abstract,
          doi: context.paper_id,
          url: context.paper_id,
          paper_id: context.paper_id, // Preserve the original paper_id
          source: context.metadata?.source || 'unknown',
          citationCount: context.metadata?.citationCount || 0,
          relevanceScore: context.metadata?.relevanceScore || 0,
          year: context.metadata?.year,
          publication: context.metadata?.publication,
          pdfUrl: context.metadata?.pdfUrl
        }))
        setSearchResults(restoredPapers)
        // Also save to localStorage for future use
        saveSearchResultsToStorage(restoredPapers, activeSession.id)
        console.log(`Restored ${restoredPapers.length} papers from session context`)
      }
    }
  }, [activeView, activeSession, sessionContext])

  const loadSessions = async () => {
    try {
      const data = await apiClient.getChatSessions()
      console.log('Loaded sessions from database:', data)
      // Handle both array and object response formats
      const sessionList = Array.isArray(data) ? data : (data?.sessions || data?.data || [])
      setSessions(sessionList)
      
      // Restore last active session after loading sessions
      if (sessionList.length > 0) {
        restoreLastActiveSession()
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
      toast.error('Failed to load sessions')
    }
  }

  const loadSessionMessages = async (sessionId: string, retryCount = 0) => {
    try {
      setLoading(true)
      const data = await apiClient.getSessionMessages(sessionId)
      // Handle both array and object response formats
      const messageList = Array.isArray(data) ? data : (data?.messages || data?.data || [])
      setMessages(messageList)
      console.log(`Loaded ${messageList.length} messages for session ${sessionId}`)
    } catch (error) {
      console.error('Error loading messages:', error)
      
      // Retry logic for transient failures
      if (retryCount < 2) {
        console.log(`Retrying message load (attempt ${retryCount + 1})...`)
        setTimeout(() => loadSessionMessages(sessionId, retryCount + 1), 1000)
        return
      }
      
      toast.error('Failed to load messages. Please refresh the page.')
      // Fallback: Set empty messages array instead of leaving undefined
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  const loadSessionContext = async () => {
    if (!activeSession) return
    try {
      const data = await apiClient.getSessionContext(activeSession.id)
      setSessionContext(data)
      
      // Always restore papers from session context if available
      if (data.length > 0) {
        // Convert PaperContext to Paper format for display
        const restoredPapers: Paper[] = data.map(context => ({
          title: context.title,
          authors: context.authors,
          abstract: context.abstract,
          doi: context.paper_id,
          url: context.paper_id,
          paper_id: context.paper_id, // Preserve the original paper_id
          source: context.metadata?.source || 'unknown',
          citationCount: context.metadata?.citationCount || 0,
          relevanceScore: context.metadata?.relevanceScore || 0,
          year: context.metadata?.year,
          publication: context.metadata?.publication,
          pdfUrl: context.metadata?.pdfUrl
        }))
        setSearchResults(restoredPapers)
        console.log(`Restored ${restoredPapers.length} papers from session context`)
      }
    } catch (error) {
      console.error('Error loading session context:', error)
    }
  }

  const handleCreateSession = async () => {
    try {
      // Generate a more descriptive title based on current context
      const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
      const title = `Research Session ${timestamp}`
      
      const session = await apiClient.createChatSession(title, { 
        createdAt: new Date().toISOString(),
        source: 'enhanced-chat'
      })
      
      // Handle both direct session object and wrapped response
      const newSession = session?.session || session
      
      setSessions(prev => [newSession, ...prev])
      setActiveSession(newSession)
      setMessages([])
      setSearchResults([])
      setGapAnalysis(null)
      setTaggedPaper(null)
      toast.success('New research session created!')
    } catch (error) {
      console.error('Error creating session:', error)
      toast.error('Failed to create session')
    }
  }

  const handleSelectSession = async (session: ChatSession) => {
    if (activeSession?.id === session.id) return // Already active
    
    try {
      setActiveSession(session)
      setMessages([]) // Clear immediately for better UX
      // Don't clear searchResults here - let loadSessionContext restore them
      setSelectedPaper(null)
      setGapAnalysis(null)
      setTaggedPaper(null)
      setActiveView('chat')
      if (isMobile) setSidebarCollapsed(true)
      
      // Load session data in parallel
      await Promise.all([
        loadSessionMessages(session.id),
        loadSessionContext()
      ])
      
      toast.success(`Switched to "${session.title}"`)
    } catch (error) {
      console.error('Error switching session:', error)
      toast.error('Failed to switch session')
    }
  }

  const handleResearchQuery = async () => {
    if (!newMessage.trim() || loading) return

    // If there's a tagged paper, handle it as a paper question
    if (taggedPaper) {
      await handlePaperQuestion(newMessage.trim())
      return
    }

    setLoading(true)
    setIsSearching(true) // Prevent session reloading during search
    
    // Auto-update session title if it's still generic
    if (activeSession && (
      activeSession.title === 'New Chat' || 
      activeSession.title.includes('Research Session') ||
      activeSession.title === 'Research Session'
    ) && newMessage.trim()) {
      try {
        const titleWords = newMessage.trim()
          .toLowerCase()
          .replace(/[^\w\s]/g, '') // Remove special characters
          .split(' ')
          .filter(word => word.length > 2 && !['and', 'the', 'for', 'with', 'about'].includes(word))
          .slice(0, 4)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        
        const newTitle = titleWords || `Research ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
        await apiClient.updateSession(activeSession.id, { title: newTitle })
        
        // Update local state
        setActiveSession(prev => prev ? { ...prev, title: newTitle } : prev)
        setSessions(prev => prev.map(s => 
          s.id === activeSession.id ? { ...s, title: newTitle } : s
        ))
        
        console.log(`Updated session title to: "${newTitle}"`)
      } catch (error) {
        console.error('Failed to update session title:', error)
      }
    }
    
    // Add user message immediately
    const userMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user' as const,
      content: newMessage.trim(),
      metadata: { type: 'research_query' },
      created_at: new Date().toISOString()
    }
    
    setMessages(prev => [...prev, userMessage])
    
    // Note: Don't save user message to backend here since the search API will handle it
    
    // Add initial search status message
    const searchMessageId = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const initialSearchMessage = {
      id: searchMessageId,
      role: 'assistant' as const,
      content: '🔍 **Starting enhanced multi-source search...**\n\n' +
               '⏳ Initializing search across multiple databases...',
      metadata: { 
        type: 'search_progress',
        isProgress: true 
      },
      created_at: new Date().toISOString()
    }
    
    setMessages(prev => [...prev, initialSearchMessage])
    
    const searchSteps = [
      { step: 'Searching Google Scholar...', icon: '📚' },
      { step: 'Searching OpenAlex...', icon: '🔬' },
      { step: 'Searching ArXiv...', icon: '📄' },
      { step: 'Searching PubMed...', icon: '🏥' },
      { step: 'Processing results...', icon: '⚙️' },
      { step: 'Removing duplicates...', icon: '🔄' },
      { step: 'Enriching metadata...', icon: '✨' }
    ]
    
    let currentStep = 0
    
    const updateSearchProgress = () => {
      if (currentStep < searchSteps.length) {
        const step = searchSteps[currentStep]
        const progressContent = `🔍 **Enhanced Multi-Source Search**\n\n` +
          searchSteps.slice(0, currentStep + 1).map((s, i) => 
            i === currentStep 
              ? `${s.icon} ${s.step} ⏳`
              : `✅ ${s.step}`
          ).join('\n') +
          (currentStep < searchSteps.length - 1 ? '\n\n⏳ Search in progress...' : '')
        
        setMessages(prev => prev.map(msg => 
          msg.id === searchMessageId 
            ? { ...msg, content: progressContent }
            : msg
        ))
        currentStep++
      }
    }
    
    // Start progress updates (faster for better perceived performance)
    updateSearchProgress()
    const progressInterval = setInterval(updateSearchProgress, 500) // Faster updates
    
    try {
      // Clear old papers when starting new research (only if we actually have new search)
      setSearchResults([])
      setGapAnalysis(null)
      
      // Use the enhanced multi-source search endpoint
      const maxResults = researchMode === 'simple' ? 10 : 40
      const response = await apiClient.searchResearch(newMessage.trim(), {
        limit: maxResults
      })

      const data = response
      clearInterval(progressInterval)

      // Update final search message with results
      const finalSearchContent = `🎉 **Search Complete!**\n\n` +
        `✅ Found **${data.papers?.length || 0}** papers from **${data.sources.length}** sources:\n` +
        data.sources.map(source => `• ${source}`).join('\n') +
        `\n\n⚡ Search completed in **${data.searchTime}ms**\n` +
        `📊 Results are displayed in the Papers tab →`

      setMessages(prev => prev.map(msg => 
        msg.id === searchMessageId 
          ? { 
              ...msg, 
              content: finalSearchContent,
              metadata: { 
                type: 'search_complete',
                paperCount: data.totalFound,
                sources: data.sources,
                searchTime: data.searchTime
              }
            }
          : msg
      ))

      // Note: Don't save search completion to backend - the search API already handles persistence

      // Update search results
      if (data.papers && data.papers.length > 0) {
        console.log(`Setting ${data.papers.length} search results`)
        
        // Set results and switch view immediately
        setSearchResults(data.papers)
        setActiveView('papers')
        
        // Save to localStorage for persistence
        if (activeSession) {
          saveSearchResultsToStorage(data.papers, activeSession.id)
          // Add papers to backend session context for RAG analysis (non-blocking)
          apiClient.addPapersToContext(activeSession.id, data.papers)
            .then(() => console.log(`Added ${data.papers.length} papers to backend session context`))
            .catch(contextError => console.error('Failed to add papers to backend session context:', contextError))
        }
      }

      setNewMessage('')
      
    } catch (error: any) {
      clearInterval(progressInterval)
      console.error('Enhanced search error:', error)
      
      // Update search message with error and try fallback
      setMessages(prev => prev.map(msg => 
        msg.id === searchMessageId 
          ? { 
              ...msg, 
              content: `⚠️ **Enhanced search failed, trying alternative method...**\n\n🔄 Switching to backup search system...`
            }
          : msg
      ))
      
      // Fallback to old search if enhanced search fails
      try {        
        const response = await apiClient.enhancedResearchChat(
          activeSession?.id || '',
          newMessage.trim(),
          {
            analysisType: 'comprehensive',
            maxResults: researchMode === 'simple' ? 10 : 40
          }
        )

        const data = response

        // Update message with fallback results
        setMessages(prev => prev.map(msg => 
          msg.id === searchMessageId 
            ? { 
                ...msg, 
                content: `✅ **Search Complete (via backup system)**\n\n${data.summary}\n\n📊 Found ${data.papers?.length || 0} papers`
              }
            : msg
        ))

        // Update search results and analysis
        if (data.papers && data.papers.length > 0) {
          console.log(`Setting ${data.papers.length} fallback search results`)
          
          // Set results and switch view immediately
          setSearchResults(data.papers)
          setActiveView('papers')
          
          // Save to localStorage for persistence
          if (activeSession) {
            saveSearchResultsToStorage(data.papers, activeSession.id)
          }
        }
        setGapAnalysis(data.gapAnalysis)
        
        // Update session if it was created (but don't reload messages during active search)
        if (data.sessionId && !activeSession) {
          const newSession = await apiClient.getChatSessions()
          const createdSession = newSession.find(s => s.id === data.sessionId)
          if (createdSession) {
            // Set session without triggering message reload (we already have the messages in state)
            setActiveSession(createdSession)
            setSessions(prev => [createdSession, ...prev.filter(s => s.id !== createdSession.id)])
            console.log('Set new session without reloading messages during search')
          }
        }
        
        // Update session context with new papers
        if (activeSession && data.papers) {
          await loadSessionContext()
        }
        
        // Update session timestamp
        setSessions(prev => prev.map(s => 
          s.id === (activeSession?.id || data.sessionId)
            ? { ...s, updated_at: new Date().toISOString() }
            : s
        ))

        setNewMessage('')
        setTaggedPaper(null)
        
      } catch (fallbackError: any) {
        console.error('Fallback search also failed:', fallbackError)
        
        // Update message with final error
        setMessages(prev => prev.map(msg => 
          msg.id === searchMessageId 
            ? { 
                ...msg, 
                content: `❌ **Search Failed**\n\nBoth primary and backup search systems failed.\n\nError: ${fallbackError.response?.data?.error || fallbackError.message || 'Unknown error'}\n\nPlease try again with a different query.`
              }
            : msg
        ))
      }
    }
    setLoading(false)
    setIsSearching(false) // Allow session reloading again
  }

  const handlePaperTag = (paper: Paper) => {
    setTaggedPaper(paper)
    setActiveView('chat')
    setNewMessage('')
    inputRef.current?.focus()
    toast.success(`Tagged paper: ${paper.title.substring(0, 50)}...`)
  }

  const handlePaperQuestion = async (question: string) => {
    if (!taggedPaper || !question.trim() || !activeSession) {
      toast.error('Please tag a paper first and enter a question')
      return
    }

    setLoading(true)
    const loadingToast = toast.loading('🤔 Analyzing paper...')
    
    try {
      // Use paper_id if available, otherwise fall back to other identifiers
      let paperId = taggedPaper.paper_id || taggedPaper.doi || taggedPaper.url || taggedPaper.title
      
      console.log('Analyzing paper with ID:', paperId)
      console.log('Paper details:', {
        title: taggedPaper.title,
        doi: taggedPaper.doi,
        url: taggedPaper.url,
        paper_id: taggedPaper.paper_id
      })

      const data = await apiClient.analyzePaper(
        {
          ...taggedPaper,
          question: question.trim()
        },
        activeSession.id
      )

      toast.dismiss(loadingToast)

      setMessages(prev => [
        ...prev,
        {
          id: generateMessageId('user'),
          role: 'user',
          content: `@${taggedPaper.title}: ${question}`,
          metadata: { type: 'paper_question', paperId: data.paperId },
          created_at: new Date().toISOString()
        },
        {
          id: generateMessageId('assistant'),
          role: 'assistant',
          content: data.analysis,
          metadata: { type: 'paper_analysis', paperId: data.paperId },
          created_at: new Date().toISOString()
        }
      ])

      // Note: Paper analysis messages are handled by the backend API, no need to save separately

      setNewMessage('')
      setTaggedPaper(null)
      toast.success('Paper analysis complete!')
    } catch (error: any) {
      toast.dismiss(loadingToast)
      console.error('Error analyzing paper:', error)
      
      // Provide more specific error messages based on the error type
      if (error.response?.status === 404) {
        toast.error('Analysis temporarily unavailable. Try again in a moment.')
        
        // Add helpful error message to chat
        setMessages(prev => [
          ...prev,
          {
            id: generateMessageId('error'),
            role: 'assistant',
            content: `⚠️ **Analysis Temporarily Unavailable**\n\nThe paper "${taggedPaper.title}" analysis failed. This usually resolves quickly.\n\n**Quick fixes:**\n• Try again in a few seconds\n• Refresh the page and retry\n• Check if the paper is still in your results\n\nThe system is working on indexing your papers for optimal performance.`,
            metadata: { type: 'error' },
            created_at: new Date().toISOString()
          }
        ])
      } else if (error.response?.status === 500) {
        toast.error('Server error during analysis. Please try again.')
      } else if (error.message?.includes('analysis')) {
        toast.error('Failed to analyze paper. Please try again.')
      } else {
        toast.error('Paper analysis failed. Please try again.')
        
        // Add generic error message to chat
        setMessages(prev => [
          ...prev,
          {
            id: generateMessageId('error'),
            role: 'assistant',
            content: `❌ **Analysis Failed**\n\nUnable to analyze the paper "${taggedPaper.title}".\n\nError: ${error.message || 'Unknown error'}\n\nPlease try again or contact support.`,
            metadata: { type: 'error' },
            created_at: new Date().toISOString()
          }
        ])
      }
    }
    setLoading(false)
  }

  const handleGenerateVisualization = async () => {
    if (!activeSession) {
      toast.error('Please create or select a session first')
      return
    }

    setLoading(true)
    const loadingToast = toast.loading('📊 Initializing research gap analysis...')
    
    try {
      console.log('🔍 Starting gap analysis for session:', activeSession.id)
      
      // Update loading message with progress
      toast.dismiss(loadingToast)
      const progressToast = toast.loading('📊 Analyzing research papers...')
      
      console.log('📈 Extracting themes and patterns from papers...')
      
      // Make the API call
      const data = await apiClient.generateVisualization(activeSession.id, 'comprehensive')
      
      // Update progress
      toast.dismiss(progressToast)
      const analysisToast = toast.loading('🧠 Generating insights and visualizations...')
      
      console.log('📊 Gap analysis data received:', {
        hasGapAnalysis: !!data.gapAnalysis,
        dataKeys: Object.keys(data),
        analysisKeys: data.gapAnalysis ? Object.keys(data.gapAnalysis) : []
      })
      
      // Simulate processing time for better UX
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      toast.dismiss(analysisToast)
      const visualizationToast = toast.loading('🎨 Creating interactive visualizations...')
      
      console.log('🎯 Processing research gaps and opportunities...')
      
      // Set the data
      setGapAnalysis(data.gapAnalysis || data)
      setActiveView('analysis')
      
      // Final update
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.dismiss(visualizationToast)
      
      console.log('✅ Gap analysis generation completed successfully')
      toast.success('🎉 Research gap analysis generated successfully!')
      
    } catch (error: any) {
      toast.dismiss(loadingToast)
      console.error('❌ Error generating gap analysis:', error)
      
      // Enhanced error logging
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      })
      
      // Provide more specific error messages
      if (error.response?.status === 400) {
        toast.error('❌ No papers available for analysis. Please search and add papers first.')
      } else if (error.response?.status === 401) {
        toast.error('🔐 Authentication required. Please log in again.')
      } else if (error.response?.status === 429) {
        toast.error('⏳ Too many requests. Please wait a moment and try again.')
      } else if (error.message?.includes('fetch') || error.message?.includes('network')) {
        toast.error('🌐 Network error. Please check your connection and try again.')
      } else if (error.message?.includes('timeout')) {
        toast.error('⏰ Request timed out. This analysis may take longer - please try again.')
      } else {
        toast.error(`❌ Failed to generate analysis: ${error.message || 'Unknown error'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateHypotheses = async () => {
    if (!activeSession) return

    setLoading(true)
    const loadingToast = toast.loading('🧪 Generating novel research hypotheses...')
    
    try {
      const data = await apiClient.generateHypotheses(activeSession.id, 'AI Research')
      setHypotheses(data)
      setActiveView('analysis')
      toast.dismiss(loadingToast)
      toast.success(`Generated ${data.hypotheses.length} novel hypotheses!`)
    } catch (error) {
      toast.dismiss(loadingToast)
      console.error('Error generating hypotheses:', error)
      toast.error('Failed to generate hypotheses')
    }
    setLoading(false)
  }

  const handleGeneratePresentation = async (paper: Paper) => {
    setLoading(true)
    const loadingToast = toast.loading('🎯 Generating PowerPoint presentation...')
    
    try {
      const data = await apiClient.generatePresentation(paper, { extractPdfContent: true })
      
      if (data.success && data.presentation) {
        // Export to Markdown for easy viewing
        const markdown = await apiClient.exportPresentationToMarkdown(data.presentation)
        
        // Create a downloadable markdown file
        const blob = new Blob([markdown.markdown], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `presentation-${paper.title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.md`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        toast.dismiss(loadingToast)
        toast.success('Presentation generated and downloaded!')
        
        // Add message to chat about the presentation
        setMessages(prev => [
          ...prev,
          {
            id: generateMessageId('assistant'),
            role: 'assistant',
            content: `🎯 **PowerPoint Presentation Generated!**\n\nI've created a comprehensive presentation for **"${paper.title}"** with the following slides:\n\n1. **Title & Authors**\n2. **Abstract Summary**\n3. **Research Problem & Motivation**\n4. **Methodology Overview**\n5. **Key Results & Findings**\n6. **Research Gaps Identified**\n7. **Conclusions & Future Work**\n8. **References & Citations**\n\n📥 The presentation has been downloaded as a Markdown file that you can easily convert to PowerPoint or use directly.`,
            metadata: { type: 'presentation_generated', paperId: paper.doi || paper.title },
            created_at: new Date().toISOString()
          }
        ])
      } else {
        throw new Error('Failed to generate presentation')
      }
    } catch (error) {
      toast.dismiss(loadingToast)
      console.error('Error generating presentation:', error)
      toast.error('Failed to generate presentation')
    }
    setLoading(false)
  }

  const handlePDFUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('File too large. Please upload a PDF under 10MB.')
      return
    }

    setLoading(true)
    const loadingToast = toast.loading('📄 Processing PDF and generating presentation...')
    
    try {
      // Convert file to base64 for processing
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })

      // Create a paper object from the uploaded PDF
      const uploadedPaper: Paper = {
        title: file.name.replace('.pdf', ''),
        authors: ['Uploaded PDF'],
        abstract: 'Content extracted from uploaded PDF',
        source: 'uploaded',
        pdfUrl: base64,
        url: base64
      }

      const data = await apiClient.generatePresentation(uploadedPaper, { extractPdfContent: true })
      
      if (data.success && data.presentation) {
        // Export to Markdown
        const markdown = await apiClient.exportPresentationToMarkdown(data.presentation)
        
        // Download the presentation
        const blob = new Blob([markdown.markdown], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `presentation-${file.name.replace('.pdf', '')}.md`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        toast.dismiss(loadingToast)
        toast.success('Presentation generated and downloaded!')
        
        // Add message to chat
        setMessages(prev => [
          ...prev,
          {
            id: generateMessageId('assistant'),
            role: 'assistant',
            content: `🎯 **PowerPoint Presentation Generated from Upload!**\n\nI've created a comprehensive presentation for **"${file.name}"** with ${data.presentation.slides.length} structured slides.\n\n📥 The presentation has been downloaded as a Markdown file that you can easily convert to PowerPoint or use directly.`,
            metadata: { type: 'presentation_generated', paperId: file.name },
            created_at: new Date().toISOString()
          }
        ])
      } else {
        throw new Error('Failed to generate presentation')
      }
    } catch (error) {
      toast.dismiss(loadingToast)
      console.error('Error processing PDF:', error)
      toast.error('Failed to process PDF and generate presentation')
    }
    setLoading(false)
  }

  const handleGeneratePresentationFromContext = async (paperContext: PaperContext) => {
    // Convert PaperContext to Paper format
    const paper: Paper = {
      title: paperContext.title,
      authors: paperContext.authors,
      abstract: paperContext.abstract,
      doi: paperContext.paper_id,
      source: 'session',
      url: paperContext.paper_id
    }
    
    await handleGeneratePresentation(paper)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleResearchQuery()
    }
  }

  const handleSessionRename = async (sessionId: string, newTitle: string) => {
    try {
      await apiClient.updateSession(sessionId, { title: newTitle })
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, title: newTitle } : s
      ))
      if (activeSession?.id === sessionId) {
        setActiveSession(prev => prev ? { ...prev, title: newTitle } : null)
      }
      setEditingSession(null)
      toast.success('Session renamed!')
    } catch (error) {
      console.error('Error renaming session:', error)
      toast.error('Failed to rename session')
    }
  }

  const handleSessionDelete = async (sessionId: string) => {
    try {
      await apiClient.deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      // Clear localStorage for this session
      clearStoredSearchResults(sessionId)
      if (activeSession?.id === sessionId) {
        setActiveSession(null)
        setMessages([])
        setSearchResults([])
        setGapAnalysis(null)
      }
      toast.success('Session deleted!')
    } catch (error) {
      console.error('Error deleting session:', error)
      toast.error('Failed to delete session')
    }
  }



  if (!user) {
    return null; // ProtectedRoute handles authentication
  }

  return (
    <div 
      className="h-screen flex overflow-hidden"
      style={{ backgroundColor: theme.colors.background }}
    >
      {/* Sidebar */}
      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.div 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={`${isMobile ? 'fixed inset-y-0 left-0 z-50' : 'relative'} w-80 h-full flex flex-col border-r`}
            style={{ 
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border
            }}
          >
            {/* Header */}
            <div 
              className="px-6 py-3 border-b flex items-center justify-between flex-shrink-0"
              style={{ borderColor: theme.colors.border }}
            >
              <h2 className="font-semibold text-lg" style={{ color: theme.colors.textPrimary }}>
                Research Sessions
              </h2>
              <div className="flex items-center gap-2">
                <motion.button 
                  onClick={handleCreateSession} 
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg font-medium text-white shadow-sm"
                  style={{ 
                    background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryHover})` 
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <HiPlus className="h-4 w-4" />
                  New
                </motion.button>
                {isMobile && (
                  <motion.button
                    onClick={() => setSidebarCollapsed(true)}
                    className="p-1.5 rounded-lg"
                    style={{ backgroundColor: theme.colors.background }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <HiX className="h-4 w-4" style={{ color: theme.colors.textSecondary }} />
                  </motion.button>
                )}
              </div>
            </div>

            {/* Sessions list */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence>
                {sessions.map((session, index) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className={`group relative p-3 border-b cursor-pointer transition-all ${
                      activeSession?.id === session.id ? 'border-l-4' : ''
                    }`}
                    style={{ 
                      borderColor: theme.colors.border,
                      borderLeftColor: activeSession?.id === session.id ? theme.colors.primary : 'transparent',
                      backgroundColor: activeSession?.id === session.id ? `${theme.colors.primary}10` : 'transparent'
                    }}
                    onClick={() => handleSelectSession(session)}
                    whileHover={{ backgroundColor: `${theme.colors.primary}05` }}
                  >
                    <div className="flex items-center justify-between">
                      {editingSession === session.id ? (
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => {
                            if (editTitle.trim() && editTitle !== session.title) {
                              handleSessionRename(session.id, editTitle.trim())
                            } else {
                              setEditingSession(null)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              if (editTitle.trim() && editTitle !== session.title) {
                                handleSessionRename(session.id, editTitle.trim())
                              } else {
                                setEditingSession(null)
                              }
                            } else if (e.key === 'Escape') {
                              setEditingSession(null)
                              setEditTitle(session.title)
                            }
                          }}
                                                      className="text-sm font-medium flex-1 mr-2 px-2 py-1 rounded border focus:outline-none focus:ring-1"
                            style={{ 
                              backgroundColor: theme.colors.background,
                              borderColor: theme.colors.primary,
                              color: theme.colors.textPrimary
                            }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div 
                          className="font-medium text-sm truncate flex-1"
                          style={{ color: theme.colors.textPrimary }}
                        >
                          {session.title}
                        </div>
                      )}
                      
                      <div className="relative">
                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDropdownOpen(dropdownOpen === session.id ? null : session.id)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                          style={{ backgroundColor: `${theme.colors.textSecondary}20` }}
                          whileHover={{ scale: 1.1 }}
                        >
                          <HiDotsVertical 
                            className="h-4 w-4" 
                            style={{ color: theme.colors.textSecondary }} 
                          />
                        </motion.button>
                        
                        <AnimatePresence>
                          {dropdownOpen === session.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-0 top-8 rounded-lg shadow-xl z-50 min-w-[120px] border"
                              style={{ 
                                backgroundColor: theme.colors.surface,
                                borderColor: theme.colors.border
                              }}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingSession(session.id)
                                  setEditTitle(session.title)
                                  setDropdownOpen(null)
                                }}
                                className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left rounded-t-lg transition-colors"
                                style={{ 
                                  color: theme.colors.textPrimary
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = `${theme.colors.primary}10`
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                              >
                                <HiPencil className="h-3 w-3" />
                                Rename
                              </button>
                              <motion.button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (window.confirm(`Delete "${session.title}"? This action cannot be undone.`)) {
                                    handleSessionDelete(session.id)
                                  }
                                  setDropdownOpen(null)
                                }}
                                className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left rounded-b-lg transition-colors"
                                style={{ 
                                  color: theme.colors.error
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = `${theme.colors.error}10`
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <HiTrash className="h-3 w-3" />
                                Delete
                              </motion.button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    
                    <div 
                      className="text-xs mt-1"
                      style={{ color: theme.colors.textMuted }}
                    >
                      {new Date(session.updated_at).toLocaleDateString()}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile overlay */}
      {isMobile && !sidebarCollapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeSession ? (
          <>
            {/* Header */}
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="p-4 border-b flex items-center justify-between"
              style={{ 
                backgroundColor: `${theme.colors.surface}80`,
                borderColor: theme.colors.border,
                backdropFilter: 'blur(8px)'
              }}
            >
              <div className="flex items-center gap-3">
                {sidebarCollapsed && (
                  <motion.button
                    onClick={() => setSidebarCollapsed(false)}
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${theme.colors.primary}10` }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <HiChatAlt2 className="h-5 w-5" style={{ color: theme.colors.primary }} />
                  </motion.button>
                )}
                <div>
                  <h3 className="font-semibold text-xl" style={{ color: theme.colors.textPrimary }}>
                    {activeSession.title}
                  </h3>
                  <div className="text-sm flex gap-4 mt-1" style={{ color: theme.colors.textSecondary }}>
                    <span className="flex items-center gap-1">
                      <HiDocumentText className="h-3 w-3" />
                      {sessionContext.length} papers in context
                    </span>
                    <span className="flex items-center gap-1">
                      <HiSearch className="h-3 w-3" />
                      {searchResults.length} papers found
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {['chat', 'papers'].map((view) => (
                  <motion.button
                    key={view}
                    onClick={() => setActiveView(view as any)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize flex items-center gap-2"
                    style={{
                      backgroundColor: activeView === view ? theme.colors.primary : `${theme.colors.primary}10`,
                      color: activeView === view ? 'white' : theme.colors.primary
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {view === 'chat' && <HiChatAlt2 className="h-4 w-4" />}
                    {view === 'papers' && <HiDocumentText className="h-4 w-4" />}
                    {view}
                    {view === 'papers' && searchResults.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-white bg-opacity-20">
                        {searchResults.length}
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Content area */}
            <div className="flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                {activeView === 'chat' && (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="h-full flex flex-col"
                  >
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                      <AnimatePresence>
                        {messages.map((message, index) => (
                          <motion.div
                            key={message.id || generateMessageId(`fallback-${index}`)}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-4xl p-4 rounded-2xl shadow-sm border ${
                                message.role === 'user'
                                  ? 'ml-4 md:ml-12 text-white'
                                  : 'mr-4 md:mr-12'
                              }`}
                              style={{
                                backgroundColor: message.role === 'user' 
                                  ? theme.colors.primary
                                  : theme.colors.surface,
                                borderColor: theme.colors.border,
                                color: message.role === 'user' ? 'white' : theme.colors.textPrimary,
                                background: message.role === 'user' 
                                  ? `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryHover})`
                                  : theme.colors.surface
                              }}
                            >
                              {message.role === 'assistant' ? (
                                <ReactMarkdown 
                                  className="prose prose-sm max-w-none"
                                  components={{
                                    p: ({ children }) => <p style={{ color: theme.colors.textPrimary }}>{children}</p>,
                                    strong: ({ children }) => <strong style={{ color: theme.colors.textPrimary }}>{children}</strong>,
                                    em: ({ children }) => <em style={{ color: theme.colors.textSecondary }}>{children}</em>,
                                    li: ({ children }) => <li style={{ color: theme.colors.textPrimary }}>{children}</li>,
                                    h1: ({ children }) => <h1 style={{ color: theme.colors.textPrimary }}>{children}</h1>,
                                    h2: ({ children }) => <h2 style={{ color: theme.colors.textPrimary }}>{children}</h2>,
                                    h3: ({ children }) => <h3 style={{ color: theme.colors.textPrimary }}>{children}</h3>,
                                  }}
                                >
                                  {message.content}
                                </ReactMarkdown>
                              ) : (
                                <p className="whitespace-pre-wrap">{message.content}</p>
                              )}
                              <div className="text-xs opacity-70 mt-3 flex items-center gap-2">
                                {new Date(message.created_at).toLocaleTimeString()}
                                {message.metadata?.type && (
                                  <span 
                                    className="px-2 py-1 rounded-full text-xs"
                                    style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
                                  >
                                    {message.metadata.type.replace('_', ' ')}
                                  </span>
                                )}
                                {message.metadata?.paperCount && (
                                  <span className="text-xs flex items-center gap-1">
                                    <HiDocumentText className="h-3 w-3" />
                                    {message.metadata.paperCount} papers
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Tagged paper indicator */}
                    <AnimatePresence>
                      {taggedPaper && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="px-4 py-2 mx-4 md:mx-6 mb-2 rounded-lg border flex items-center justify-between"
                          style={{ 
                            backgroundColor: `${theme.colors.accent}10`,
                            borderColor: theme.colors.accent
                          }}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <HiBookOpen 
                              className="h-4 w-4 flex-shrink-0" 
                              style={{ color: theme.colors.accent }} 
                            />
                            <span 
                              className="text-sm font-medium truncate"
                              style={{ color: theme.colors.textPrimary }}
                            >
                              @{taggedPaper.title}
                            </span>
                          </div>
                          <motion.button
                            onClick={() => setTaggedPaper(null)}
                            className="p-1 rounded"
                            style={{ color: theme.colors.textSecondary }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <HiX className="h-4 w-4" />
                          </motion.button>
                        </motion.div>
                      )}
                      
                      {/* Contextual Question Suggestions */}
                      {taggedPaper && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="px-4 md:px-6 mb-2"
                        >
                          <p className="text-xs mb-2" style={{ color: theme.colors.textSecondary }}>
                            💡 Try asking:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              "What is the main contribution?",
                              "What methodology was used?",
                              "What are the key findings?",
                              "What are the limitations?",
                              "How does this relate to other work?",
                              "What future work is suggested?"
                            ].map((suggestion, i) => (
                              <motion.button
                                key={`suggestion-${i}-${suggestion.slice(0, 10)}`}
                                onClick={() => setNewMessage(suggestion)}
                                className="text-xs px-3 py-1.5 rounded-full transition-colors"
                                style={{
                                  backgroundColor: `${theme.colors.primary}10`,
                                  color: theme.colors.primary
                                }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.05 }}
                              >
                                {suggestion}
                              </motion.button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Research Mode Toggle */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="px-4 md:px-6 py-3 border-t"
                      style={{ 
                        backgroundColor: `${theme.colors.surface}60`,
                        borderColor: theme.colors.border,
                        backdropFilter: 'blur(12px)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium" style={{ color: theme.colors.textSecondary }}>
                          Research Mode
                        </span>
                        <div className="flex items-center gap-2">
                          <motion.button
                            onClick={() => setResearchMode('simple')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                              researchMode === 'simple' ? 'text-white' : ''
                            }`}
                            style={{
                              backgroundColor: researchMode === 'simple' ? theme.colors.success : `${theme.colors.success}20`,
                              color: researchMode === 'simple' ? 'white' : theme.colors.success
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Simple (10 papers)
                          </motion.button>
                          <motion.button
                            onClick={() => setResearchMode('max')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                              researchMode === 'max' ? 'text-white' : ''
                            }`}
                            style={{
                              backgroundColor: researchMode === 'max' ? theme.colors.primary : `${theme.colors.primary}20`,
                              color: researchMode === 'max' ? 'white' : theme.colors.primary
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Max (40 papers)
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>

                    {/* Input area */}
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="p-4 md:p-6 border-t"
                      style={{ 
                        backgroundColor: `${theme.colors.surface}80`,
                        borderColor: theme.colors.border,
                        backdropFilter: 'blur(8px)'
                      }}
                    >
                      <div className="flex gap-3">
                        <div className="flex-1 relative">
                          <input
                            ref={inputRef}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={taggedPaper ? `Ask about "${(taggedPaper as any).title?.substring(0, 30)}..."` : "Ask a research question or search for papers..."}
                            className="w-full p-3 pr-12 rounded-xl border focus:outline-none focus:ring-2 transition-all"
                            style={{ 
                              backgroundColor: theme.colors.background,
                              borderColor: theme.colors.border,
                              color: theme.colors.textPrimary
                            }}
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = theme.colors.primary
                              e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.colors.primary}40`
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = theme.colors.border
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                            disabled={loading}
                          />
                          <HiSearch 
                            className="absolute right-3 top-3 h-5 w-5" 
                            style={{ color: theme.colors.textMuted }} 
                          />
                        </div>
                        <motion.button
                          onClick={handleResearchQuery}
                          disabled={!newMessage.trim() || loading}
                          className="px-4 py-3 rounded-xl font-medium text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          style={{ 
                            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryHover})` 
                          }}
                          whileHover={{ scale: newMessage.trim() && !loading ? 1.05 : 1 }}
                          whileTap={{ scale: newMessage.trim() && !loading ? 0.95 : 1 }}
                        >
                          {loading ? (
                            <div className="flex items-center">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="rounded-full h-4 w-4 border-b-2 border-white mr-2"
                              />
                              Searching...
                            </div>
                          ) : (
                            <>
                              <HiSparkles className="h-4 w-4" />
                              {isMobile ? 'Search' : 'Search'}
                            </>
                          )}
                        </motion.button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}

                {activeView === 'papers' && (
                  <motion.div
                    key="papers"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="h-full overflow-y-auto p-4 md:p-6"
                  >
                    {/* Semantic search status indicator */}
                    {loading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center justify-center p-8"
                      >
                        <div className="flex items-center space-x-3">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-6 h-6 border-2 border-t-transparent rounded-full"
                            style={{ borderColor: theme.colors.primary }}
                          />
                          <span style={{ color: theme.colors.textPrimary }}>
                            Searching research papers...
                          </span>
                        </div>
                      </motion.div>
                    )}

                    {!loading && searchResults.length > 0 ? (
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {searchResults.map((paper, i) => (
                          <motion.div
                            key={`paper-${(paper as any).paper_id || paper.doi || paper.url || paper.title || i}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-xl p-5 border cursor-pointer group transition-all hover:shadow-lg"
                            style={{ 
                              backgroundColor: theme.colors.surface,
                              borderColor: theme.colors.border
                            }}
                            onClick={() => setSelectedPaper(paper)}
                            whileHover={{ 
                              scale: 1.02,
                              boxShadow: `0 8px 32px ${theme.colors.primary}20`
                            }}
                          >
                            <div 
                              className="font-medium text-sm mb-3 line-clamp-2 group-hover:text-opacity-80 transition-colors"
                              style={{ color: theme.colors.textPrimary }}
                            >
                              {paper.title}
                            </div>
                            <div 
                              className="text-xs mb-2"
                              style={{ color: theme.colors.textSecondary }}
                            >
                              {(() => {
                                // Format authors - limit to 3 authors
                                let authorsText = "Unknown Authors";
                                if (paper.authors) {
                                  if (Array.isArray(paper.authors)) {
                                    const limitedAuthors = paper.authors.slice(0, 3);
                                    authorsText = limitedAuthors.join(", ");
                                    if (paper.authors.length > 3) {
                                      authorsText += ` et al. (${paper.authors.length} authors)`;
                                    }
                                  } else if (typeof paper.authors === 'string') {
                                    const authorsList = paper.authors.split(',').map(a => a.trim());
                                    const limitedAuthors = authorsList.slice(0, 3);
                                    authorsText = limitedAuthors.join(", ");
                                    if (authorsList.length > 3) {
                                      authorsText += ` et al. (${authorsList.length} authors)`;
                                    }
                                  } else {
                                    authorsText = String(paper.authors);
                                  }
                                }
                                return authorsText;
                              })()}
                              {paper.isOpenAccess && (
                                <span className="ml-2 px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">
                                  🟢 Open Access
                                </span>
                              )}
                              {paper.oaHostType && (
                                <span className="ml-1 px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs">
                                  📚 {paper.oaHostType}
                                </span>
                              )}
                            </div>
                            <div 
                              className="text-xs mb-4 line-clamp-3"
                              style={{ color: theme.colors.textMuted }}
                            >
                              {paper.abstract}
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex gap-2 text-xs">
                                {paper.citationCount > 0 && (
                                  <span 
                                    className="px-2 py-1 rounded-full"
                                    style={{ 
                                      backgroundColor: `${theme.colors.info}20`,
                                      color: theme.colors.info
                                    }}
                                  >
                                    📊 {paper.citationCount}
                                  </span>
                                )}
                                {paper.relevanceScore && paper.relevanceScore > 0 && (
                                  <span 
                                    className="px-2 py-1 rounded-full"
                                    style={{ 
                                      backgroundColor: `${theme.colors.success}20`,
                                      color: theme.colors.success
                                    }}
                                  >
                                    🎯 {(paper.relevanceScore * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 flex gap-2">
                                <motion.button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const url = paper.pdfUrl || paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : null)
                                    if (url) {
                                      window.open(url, '_blank')
                                      toast.success('Opening paper...')
                                    } else {
                                      toast.error('No link available for this paper')
                                    }
                                  }}
                                  className="px-3 py-1 text-sm rounded-lg font-medium text-white transition-all"
                                  style={{ 
                                    background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryHover})` 
                                  }}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  title="Open/Download Paper"
                                >
                                  📄 Open
                                </motion.button>
                                <CitationButton 
                                  paperData={paper} 
                                  variant="secondary" 
                                  size="sm"
                                  className="text-xs"
                                />
                                <motion.button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handlePaperTag(paper)
                                  }}
                                  className="px-3 py-1 text-sm rounded-lg font-medium text-white transition-all"
                                  style={{ 
                                    background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.success})` 
                                  }}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  title="Ask questions about this paper"
                                >
                                  🤔 Ask
                                </motion.button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <motion.div
                          animate={{ 
                            y: [0, -10, 0],
                            rotate: [0, 5, -5, 0]
                          }}
                          transition={{ duration: 3, repeat: Infinity }}
                          className="text-6xl mb-4"
                        >
                          🔍
                        </motion.div>
                        <h3 
                          className="text-xl font-semibold mb-2"
                          style={{ color: theme.colors.textPrimary }}
                        >
                          No papers found yet
                        </h3>
                        <p 
                          className="mb-4"
                          style={{ color: theme.colors.textSecondary }}
                        >
                          {searchResults.length === 0 && messages.length > 0 
                            ? "No relevant papers found for your query. Try different keywords or a broader search."
                            : "Start a research query to discover relevant papers"
                          }
                        </p>
                        <motion.button
                          onClick={() => setActiveView('chat')}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white"
                          style={{ 
                            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryHover})` 
                          }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <HiArrowRight className="h-4 w-4" />
                          Start Research
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex items-center justify-center p-4"
          >
            <div className="text-center space-y-6 max-w-md">
              <motion.div
                animate={{ 
                  y: [0, -20, 0],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="text-8xl mb-4"
              >
                🚀
              </motion.div>
              <h3 
                className="text-2xl font-bold"
                style={{ color: theme.colors.textPrimary }}
              >
                Start Your Research Journey
              </h3>
              <p 
                className="text-lg"
                style={{ color: theme.colors.textSecondary }}
              >
                Create a new session to begin exploring research papers with AI assistance
              </p>
              <motion.button 
                onClick={handleCreateSession} 
                className="inline-flex items-center gap-2 text-lg px-8 py-3 rounded-lg font-medium text-white shadow-lg"
                style={{ 
                  background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryHover})` 
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <HiSparkles className="h-5 w-5" />
                Create Research Session
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Paper detail modal */}
      <AnimatePresence>
        {selectedPaper && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedPaper(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-xl max-w-4xl w-full max-h-[80vh] overflow-auto p-6 border"
              style={{ 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 
                  className="text-lg font-semibold"
                  style={{ color: theme.colors.textPrimary }}
                >
                  Paper Details
                </h3>
                <motion.button
                  onClick={() => setSelectedPaper(null)}
                  className="px-3 py-1 rounded-lg"
                  style={{ backgroundColor: `${theme.colors.textSecondary}20` }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <HiX className="h-4 w-4" style={{ color: theme.colors.textSecondary }} />
                </motion.button>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 
                    className="font-medium mb-2"
                    style={{ color: theme.colors.textPrimary }}
                  >
                    {selectedPaper.title}
                  </h4>
                  <p 
                    className="text-sm"
                    style={{ color: theme.colors.textSecondary }}
                  >
                    {Array.isArray(selectedPaper.authors) ? selectedPaper.authors.join(', ') : selectedPaper.authors || "Unknown Authors"}
                  </p>
                </div>
                <div>
                  <h5 
                    className="font-medium text-sm mb-1"
                    style={{ color: theme.colors.textPrimary }}
                  >
                    Abstract
                  </h5>
                  <p 
                    className="text-sm"
                    style={{ color: theme.colors.textSecondary }}
                  >
                    {selectedPaper.abstract}
                  </p>
                </div>
                {/* Additional paper metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedPaper.source && (
                    <div>
                      <span className="font-medium" style={{ color: theme.colors.textPrimary }}>Source: </span>
                      <span style={{ color: theme.colors.textSecondary }}>{selectedPaper.source}</span>
                    </div>
                  )}
                  {selectedPaper.year && (
                    <div>
                      <span className="font-medium" style={{ color: theme.colors.textPrimary }}>Year: </span>
                      <span style={{ color: theme.colors.textSecondary }}>{selectedPaper.year}</span>
                    </div>
                  )}
                  {selectedPaper.publication && (
                    <div>
                      <span className="font-medium" style={{ color: theme.colors.textPrimary }}>Publication: </span>
                      <span style={{ color: theme.colors.textSecondary }}>{selectedPaper.publication}</span>
                    </div>
                  )}
                  {selectedPaper.citationCount > 0 && (
                    <div>
                      <span className="font-medium" style={{ color: theme.colors.textPrimary }}>Citations: </span>
                      <span style={{ color: theme.colors.textSecondary }}>{selectedPaper.citationCount}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {selectedPaper.url && (
                    <motion.a
                      href={selectedPaper.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium"
                      style={{ 
                        backgroundColor: `${theme.colors.info}20`,
                        color: theme.colors.info
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <HiBookOpen className="h-4 w-4" />
                      View Paper
                    </motion.a>
                  )}
                  {selectedPaper.pdfUrl && (
                    <motion.a
                      href={selectedPaper.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium"
                      style={{ 
                        backgroundColor: `${theme.colors.error}20`,
                        color: theme.colors.error
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <HiDocumentText className="h-4 w-4" />
                      PDF
                    </motion.a>
                  )}
                  <motion.button
                    onClick={() => {
                      handlePaperTag(selectedPaper)
                      setSelectedPaper(null)
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium text-white"
                    style={{ 
                      background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.success})` 
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <HiChatAlt2 className="h-4 w-4" />
                    Ask Question
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click outside to close dropdown */}
      {dropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setDropdownOpen(null)}
        />
      )}
    </div>
  )
}