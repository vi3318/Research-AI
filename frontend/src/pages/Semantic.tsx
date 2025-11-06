import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiSearch, HiSparkles, HiLightBulb, HiBeaker, HiBookmark, HiCheck, HiRefresh, HiTrash, HiViewList, HiX, HiFilter } from 'react-icons/hi'
import { useTheme } from '../contexts/ThemeContext'
import { semanticIndex, semanticQuery } from '../lib/api'
import toast from 'react-hot-toast'

type Workspace = {
  id: string
  name: string
  description?: string
}

export default function Semantic() {
  const { theme } = useTheme()
  const [namespace, setNamespace] = useState('papers')
  const [raw, setRaw] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchType, setSearchType] = useState<'semantic' | 'conceptual' | 'contextual'>('semantic')
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null)
  const [pinningPapers, setPinningPapers] = useState<Set<string>>(new Set())
  const [pinnedPapers, setPinnedPapers] = useState<Set<string>>(new Set())
  const [indexedPapers, setIndexedPapers] = useState<any[]>([])
  const [showIndexedModal, setShowIndexedModal] = useState(false)
  const [filterYear, setFilterYear] = useState<string>('')
  const [filterAuthor, setFilterAuthor] = useState<string>('')
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [availableAuthors, setAvailableAuthors] = useState<string[]>([])
  const [clearing, setClearing] = useState(false)

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces()
    loadIndexedPapers()
  }, [])

  // Reload workspaces when user logs in
  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (token) {
      loadWorkspaces()
    }
  }, [])

  // Update available filters when indexed papers change
  useEffect(() => {
    if (indexedPapers.length > 0) {
      const years = new Set<number>()
      const authors = new Set<string>()
      
      indexedPapers.forEach(paper => {
        const metadata = paper.metadata || {}
        if (metadata.year) years.add(metadata.year)
        if (metadata.authors) {
          const authorList = Array.isArray(metadata.authors) 
            ? metadata.authors 
            : metadata.authors.split(', ')
          authorList.forEach((author: string) => authors.add(author.trim()))
        }
      })
      
      setAvailableYears(Array.from(years).sort((a, b) => b - a))
      setAvailableAuthors(Array.from(authors).sort())
    }
  }, [indexedPapers])

  async function loadWorkspaces() {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        console.log('No auth token found')
        return
      }

      console.log('Loading workspaces with token:', token.substring(0, 20) + '...')

      const response = await fetch('/api/workspaces', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Workspaces loaded:', data.workspaces)
        setWorkspaces(data.workspaces || [])
        if (data.workspaces && data.workspaces.length > 0) {
          setSelectedWorkspace(data.workspaces[0].id)
        }
      } else {
        console.error('Failed to load workspaces:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error)
    }
  }

  async function loadIndexedPapers() {
    try {
      const response = await fetch(`/api/semantic/indexed?namespace=${namespace}`)
      if (response.ok) {
        const data = await response.json()
        setIndexedPapers(data.papers || [])
      }
    } catch (error) {
      console.error('Failed to load indexed papers:', error)
    }
  }

  async function loadFromPinnedPapers() {
    if (!selectedWorkspace) {
      toast.error('Please select a workspace first')
      return
    }

    const loadingToast = toast.loading('📚 Loading pinned papers...')
    
    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        toast.dismiss(loadingToast)
        toast.error('Please log in first')
        return
      }

      // Fetch pinned papers from the workspace
      const response = await fetch(`/api/workspaces/${selectedWorkspace}/papers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch pinned papers')
      }

      const data = await response.json()
      const papers = data.papers || []

      if (papers.length === 0) {
        toast.dismiss(loadingToast)
        toast.error('No pinned papers found in this workspace')
        return
      }

      // Transform papers to the format expected by semantic index
      const items = papers.map((paper: any) => ({
        paper: {
          title: paper.title,
          authors: paper.authors || [],
          year: paper.publication_year,
          abstract: paper.abstract || '',
          publication: paper.journal || paper.venue || '',
          citationCount: paper.citation_count || 0,
          keywords: paper.keywords || [],
          pdfUrl: paper.pdf_url,
          url: paper.paper_url,
          fullText: paper.notes || ''
        }
      }))

      toast.dismiss(loadingToast)
      const indexingToast = toast.loading(`🔍 Indexing ${papers.length} papers...`)

      // Index the papers
      await semanticIndex(namespace, items)
      
      toast.dismiss(indexingToast)
      toast.success(`✅ Successfully indexed ${papers.length} papers from your workspace!`)
      
      // Reload indexed papers
      await loadIndexedPapers()

    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error('Failed to load pinned papers')
      console.error('Load from pinned papers error:', error)
    }
  }

  async function clearIndex() {
    if (!confirm(`Are you sure you want to clear all indexed papers from "${namespace}"?`)) {
      return
    }

    setClearing(true)
    const loadingToast = toast.loading('🗑️ Clearing index...')

    try {
      const response = await fetch('/api/semantic/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namespace })
      })

      if (response.ok) {
        toast.dismiss(loadingToast)
        toast.success('Index cleared successfully!')
        setIndexedPapers([])
        setResults([])
      } else {
        throw new Error('Failed to clear index')
      }
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error('Failed to clear index')
      console.error('Clear error:', error)
    }
    setClearing(false)
  }

  async function logSearchQuery(query: string, resultsCount: number, executionTime: number) {
    try {
      await fetch('/api/semantic/log-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namespace,
          query,
          searchMode: searchType,
          resultsCount,
          filterYear: filterYear || null,
          filterAuthor: filterAuthor || null,
          executionTime
        })
      })
    } catch (error) {
      console.error('Failed to log query:', error)
    }
  }

  async function pinPaperToWorkspace(paper: any, workspaceId: string) {
    const paperId = paper.id || paper.metadata?.title
    setPinningPapers(prev => new Set(prev).add(paperId))

    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        toast.error('Please log in to pin papers')
        return
      }

      const metadata = paper.metadata || {}
      const response = await fetch(`/api/workspaces/${workspaceId}/papers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paper_id: paper.id || `paper_${Date.now()}`,
          title: metadata.title || 'Untitled',
          authors: Array.isArray(metadata.authors) ? metadata.authors : 
                   (metadata.authors?.split?.(', ') || ['Unknown Author']),
          abstract: metadata.abstract || metadata.text || '',
          publication_year: metadata.year || null,
          journal: metadata.publication || metadata.venue || '',
          citation_count: metadata.citationCount || 0,
          keywords: metadata.keywords || [],
          pdf_url: metadata.pdfUrl || '',
          paper_url: metadata.url || '',
          notes: '',
          tags: []
        })
      })

      if (response.ok) {
        setPinnedPapers(prev => new Set(prev).add(paperId))
        toast.success(`Pinned to ${workspaces.find(w => w.id === workspaceId)?.name || 'workspace'}!`)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to pin paper')
      }
    } catch (error) {
      console.error('Pin error:', error)
      toast.error('Failed to pin paper')
    } finally {
      setPinningPapers(prev => {
        const next = new Set(prev)
        next.delete(paperId)
        return next
      })
    }
  }
  
  async function onIndex() {
    try {
      let items: any[] = []
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) items = parsed.map(p => ({ paper: p }))
      } catch {
        if (raw.trim()) items = [{ text: raw.trim() }]
      }
      if (!items.length) {
        toast.error('No content to index')
        return
      }
      
      const loadingToast = toast.loading('🔍 Indexing content...')
      await semanticIndex(namespace, items)
      toast.dismiss(loadingToast)
      toast.success('Content indexed successfully!')
      setRaw('')
      
      // Reload indexed papers
      await loadIndexedPapers()
    } catch (e) {
      toast.error('Indexing failed')
    }
  }

  async function onQuery() {
    if (!query.trim()) return
    
    setLoading(true)
    const loadingToast = toast.loading('🔍 Performing semantic search...')
    const startTime = Date.now()
    
    try {
      const res = await semanticQuery(namespace, query, 10)
      let filteredResults = res.results || []
      
      // Apply filters
      if (filterYear) {
        filteredResults = filteredResults.filter((r: any) => 
          r.metadata?.year === parseInt(filterYear)
        )
      }
      if (filterAuthor) {
        filteredResults = filteredResults.filter((r: any) => {
          const authors = Array.isArray(r.metadata?.authors) 
            ? r.metadata.authors 
            : (r.metadata?.authors?.split?.(', ') || [])
          return authors.some((a: string) => a.toLowerCase().includes(filterAuthor.toLowerCase()))
        })
      }
      
      const executionTime = Date.now() - startTime
      setResults(filteredResults)
      toast.dismiss(loadingToast)
      toast.success(`Found ${filteredResults.length} semantically similar results!`)
      
      // Log the query
      await logSearchQuery(query, filteredResults.length, executionTime)
    } catch (error) {
      console.error('Search failed:', error)
      toast.dismiss(loadingToast)
      toast.error('Semantic search failed')
    }
    setLoading(false)
  }

  const searchTypes = [
    { key: 'semantic', label: 'Semantic', icon: HiSparkles, desc: 'Find by meaning and context' },
    { key: 'conceptual', label: 'Conceptual', icon: HiLightBulb, desc: 'Discover related concepts' },
    { key: 'contextual', label: 'Contextual', icon: HiBeaker, desc: 'Context-aware search' }
  ]

  const exampleQueries = [
    "How does machine learning improve drug discovery?",
    "What are the ethical implications of AI in healthcare?",
    "Quantum computing applications in cryptography",
    "Climate change impact on biodiversity"
  ]

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: theme.colors.background }}>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="flex items-center justify-center gap-3">
            <motion.div
              className="p-3 rounded-full"
              style={{ backgroundColor: `${theme.colors.primary}20` }}
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <HiSparkles className="h-8 w-8" style={{ color: theme.colors.primary }} />
            </motion.div>
            <h1 className="text-3xl font-bold" style={{ color: theme.colors.textPrimary }}>
              Semantic Search
            </h1>
          </div>
          <p className="text-lg" style={{ color: theme.colors.textSecondary }}>
            Index and search research papers by meaning, context, and conceptual similarity
          </p>
        </motion.div>

        {/* Search Type Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center gap-4"
        >
          {searchTypes.map((type, index) => (
            <motion.button
              key={type.key}
              onClick={() => setSearchType(type.key as any)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all"
              style={{
                backgroundColor: searchType === type.key ? theme.colors.primary : `${theme.colors.primary}10`,
                color: searchType === type.key ? 'white' : theme.colors.primary
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <type.icon className="h-4 w-4" />
              {type.label}
            </motion.button>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Index Section */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl p-6 border"
            style={{ 
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border
            }}
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
              <HiBeaker className="h-5 w-5" style={{ color: theme.colors.accent }} />
              Index Content
            </h2>
            
            <div className="space-y-4">
              {/* Workspace Selector - Always show */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.textSecondary }}>
                  Pin results to workspace:
                </label>
                {workspaces.length > 0 ? (
                  <select
                    value={selectedWorkspace || ''}
                    onChange={(e) => setSelectedWorkspace(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border,
                      color: theme.colors.textPrimary
                    }}
                  >
                    {workspaces.map(workspace => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3 py-2 rounded-lg border text-sm" style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    color: theme.colors.textMuted
                  }}>
                    Please log in and create a workspace to pin papers
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <input 
                  value={namespace} 
                  onChange={e => setNamespace(e.target.value)} 
                  placeholder="Namespace (e.g., papers, research)"
                  className="flex-1 px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    color: theme.colors.textPrimary
                  }}
                />
                <motion.button 
                  className="btn text-white"
                  style={{ 
                    background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.success})` 
                  }}
                  onClick={onIndex}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Index
                </motion.button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                <motion.button
                  onClick={loadFromPinnedPapers}
                  disabled={!selectedWorkspace}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg font-medium transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: `${theme.colors.success}20`,
                    color: theme.colors.success
                  }}
                  whileHover={{ scale: selectedWorkspace ? 1.05 : 1 }}
                  whileTap={{ scale: selectedWorkspace ? 0.95 : 1 }}
                  title="Load papers from your pinned collection"
                >
                  <HiBookmark className="h-4 w-4" />
                  Load from Pinned Papers
                </motion.button>

                <motion.button
                  onClick={() => setShowIndexedModal(true)}
                  disabled={indexedPapers.length === 0}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg font-medium transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: `${theme.colors.info}20`,
                    color: theme.colors.info
                  }}
                  whileHover={{ scale: indexedPapers.length > 0 ? 1.05 : 1 }}
                  whileTap={{ scale: indexedPapers.length > 0 ? 0.95 : 1 }}
                >
                  <HiViewList className="h-4 w-4" />
                  View Indexed ({indexedPapers.length})
                </motion.button>

                <motion.button
                  onClick={clearIndex}
                  disabled={clearing || indexedPapers.length === 0}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg font-medium transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: `${theme.colors.error}20`,
                    color: theme.colors.error
                  }}
                  whileHover={{ scale: indexedPapers.length > 0 && !clearing ? 1.05 : 1 }}
                  whileTap={{ scale: indexedPapers.length > 0 && !clearing ? 0.95 : 1 }}
                >
                  {clearing ? (
                    <>
                      <HiRefresh className="h-4 w-4 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    <>
                      <HiTrash className="h-4 w-4" />
                      Clear Index
                    </>
                  )}
                </motion.button>
              </div>
              
              <div>
                <p className="text-sm mb-2" style={{ color: theme.colors.textSecondary }}>
                  Paste raw text or JSON array of papers (with title, authors, year, abstract, fullText):
                </p>
                <textarea 
                  value={raw} 
                  onChange={e => setRaw(e.target.value)} 
                  className="w-full h-40 rounded-lg border p-3 focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    color: theme.colors.textPrimary
                  }}
                  placeholder="Enter content to index..."
                />
              </div>
            </div>
          </motion.div>

          {/* Search Section */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl p-6 border"
            style={{ 
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border
            }}
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
              <HiSearch className="h-5 w-5" style={{ color: theme.colors.primary }} />
              Semantic Query
            </h2>
            
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input 
                    value={query} 
                    onChange={e => setQuery(e.target.value)} 
                    onKeyPress={(e) => e.key === 'Enter' && onQuery()}
                    placeholder={`Enter your ${searchType} search query...`}
                    className="w-full px-3 py-2 pr-10 rounded-lg border focus:outline-none focus:ring-2 transition-all"
                    style={{
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border,
                      color: theme.colors.textPrimary
                    }}
                    disabled={loading}
                  />
                  <HiSearch 
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4" 
                    style={{ color: theme.colors.textMuted }}
                  />
                </div>
                <motion.button 
                  className="btn text-white disabled:opacity-50"
                  style={{ 
                    background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryHover})` 
                  }}
                  onClick={onQuery}
                  disabled={loading || !query.trim()}
                  whileHover={{ scale: loading || !query.trim() ? 1 : 1.05 }}
                  whileTap={{ scale: loading || !query.trim() ? 1 : 0.95 }}
                >
                  {loading ? 'Searching...' : 'Search'}
                </motion.button>
              </div>
              
              {/* Filters */}
              {availableYears.length > 0 || availableAuthors.length > 0 ? (
                <div className="flex gap-3 items-center">
                  <HiFilter className="h-4 w-4" style={{ color: theme.colors.textMuted }} />
                  <span className="text-sm font-medium" style={{ color: theme.colors.textSecondary }}>Filters:</span>
                  
                  {availableYears.length > 0 && (
                    <select
                      value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value)}
                      className="px-3 py-1 text-sm rounded-lg border focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                        color: theme.colors.textPrimary
                      }}
                    >
                      <option value="">All Years</option>
                      {availableYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  )}
                  
                  {availableAuthors.length > 0 && (
                    <input
                      type="text"
                      value={filterAuthor}
                      onChange={(e) => setFilterAuthor(e.target.value)}
                      placeholder="Filter by author..."
                      className="px-3 py-1 text-sm rounded-lg border focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                        color: theme.colors.textPrimary
                      }}
                    />
                  )}
                  
                  {(filterYear || filterAuthor) && (
                    <motion.button
                      onClick={() => { setFilterYear(''); setFilterAuthor('') }}
                      className="text-xs px-2 py-1 rounded-full transition-colors"
                      style={{
                        backgroundColor: `${theme.colors.error}20`,
                        color: theme.colors.error
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Clear Filters
                    </motion.button>
                  )}
                </div>
              ) : null}
              
              {/* Example queries */}
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: theme.colors.textSecondary }}>
                  Try these examples:
                </p>
                <div className="flex flex-wrap gap-2">
                  {exampleQueries.map((example, i) => (
                    <motion.button
                      key={i}
                      onClick={() => setQuery(example)}
                      className="text-xs px-3 py-1 rounded-full transition-colors"
                      style={{
                        backgroundColor: `${theme.colors.accent}10`,
                        color: theme.colors.accent
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {example.length > 30 ? `${example.substring(0, 30)}...` : example}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Results */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl p-6 border"
          style={{ 
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold" style={{ color: theme.colors.textPrimary }}>
              Search Results
            </h3>
            <span className="px-3 py-1 rounded-full text-sm" style={{
              backgroundColor: `${theme.colors.info}20`,
              color: theme.colors.info
            }}>
              {results.length} results
            </span>
          </div>
          
          {results.length === 0 ? (
            <div className="text-center py-12">
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
              <h4 className="text-lg font-medium mb-2" style={{ color: theme.colors.textPrimary }}>
                No results yet
              </h4>
              <p style={{ color: theme.colors.textSecondary }}>
                Index some content and then search to see semantic results
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {results.map((result: any, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-5 rounded-lg border hover:shadow-lg transition-all cursor-pointer group"
                    style={{ 
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border
                    }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span 
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: result.score > 0.8 ? `${theme.colors.success}20` : `${theme.colors.warning}20`,
                            color: result.score > 0.8 ? theme.colors.success : theme.colors.warning
                          }}
                        >
                          Score: {result.score?.toFixed?.(3) || 'N/A'}
                        </span>
                        <span 
                          className="text-xs px-2 py-1 rounded-full"
                          style={{
                            backgroundColor: `${theme.colors.info}10`,
                            color: theme.colors.info
                          }}
                        >
                          {namespace}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Pin to Workspace Button */}
                        {selectedWorkspace && (
                          <motion.button
                            onClick={() => pinPaperToWorkspace(result, selectedWorkspace)}
                            disabled={pinningPapers.has(result.id || result.metadata?.title) || pinnedPapers.has(result.id || result.metadata?.title)}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              backgroundColor: pinnedPapers.has(result.id || result.metadata?.title) 
                                ? `${theme.colors.success}20` 
                                : `${theme.colors.accent}20`,
                              color: pinnedPapers.has(result.id || result.metadata?.title) 
                                ? theme.colors.success 
                                : theme.colors.accent
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {pinningPapers.has(result.id || result.metadata?.title) ? (
                              <>
                                <HiRefresh className="h-3 w-3 animate-spin" />
                                Pinning...
                              </>
                            ) : pinnedPapers.has(result.id || result.metadata?.title) ? (
                              <>
                                <HiCheck className="h-3 w-3" />
                                Pinned
                              </>
                            ) : (
                              <>
                                <HiBookmark className="h-3 w-3" />
                                Pin
                              </>
                            )}
                          </motion.button>
                        )}
                        <motion.button
                          className="opacity-0 group-hover:opacity-100 px-3 py-1 text-xs rounded-full font-medium text-white transition-all"
                          style={{ 
                            background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.success})` 
                          }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          View Details
                        </motion.button>
                      </div>
                    </div>
                    <h4 className="font-medium mb-2 group-hover:text-opacity-80 transition-colors" style={{ color: theme.colors.textPrimary }}>
                      {result.metadata?.title || result.metadata?.text || result.id || 'Untitled'}
                    </h4>
                    {result.metadata?.authors && (
                      <p className="text-sm mb-2" style={{ color: theme.colors.textSecondary }}>
                        {result.metadata.authors} {result.metadata?.year && `· ${result.metadata.year}`}
                      </p>
                    )}
                    {result.metadata?.abstract && (
                      <p className="text-sm" style={{ color: theme.colors.textMuted }}>
                        {result.metadata.abstract.substring(0, 200)}...
                      </p>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Indexed Papers Modal */}
        <AnimatePresence>
          {showIndexedModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center p-6 z-50"
              onClick={() => setShowIndexedModal(false)}
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
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold" style={{ color: theme.colors.textPrimary }}>
                    Indexed Papers ({indexedPapers.length})
                  </h3>
                  <motion.button
                    onClick={() => setShowIndexedModal(false)}
                    className="p-2 rounded-lg transition-colors"
                    style={{
                      backgroundColor: `${theme.colors.error}20`,
                      color: theme.colors.error
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <HiX className="h-5 w-5" />
                  </motion.button>
                </div>

                <div className="space-y-3">
                  {indexedPapers.map((paper, i) => (
                    <motion.div
                      key={paper.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-4 rounded-lg border"
                      style={{
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium mb-1" style={{ color: theme.colors.textPrimary }}>
                            {paper.metadata?.title || paper.metadata?.text?.substring(0, 60) || paper.id}
                          </h4>
                          {paper.metadata?.authors && (
                            <p className="text-sm mb-1" style={{ color: theme.colors.textSecondary }}>
                              {Array.isArray(paper.metadata.authors) 
                                ? paper.metadata.authors.join(', ') 
                                : paper.metadata.authors}
                              {paper.metadata?.year && ` · ${paper.metadata.year}`}
                            </p>
                          )}
                          {paper.metadata?.abstract && (
                            <p className="text-xs" style={{ color: theme.colors.textMuted }}>
                              {paper.metadata.abstract.substring(0, 150)}...
                            </p>
                          )}
                        </div>
                        <span className="ml-3 px-2 py-1 text-xs rounded-full whitespace-nowrap" style={{
                          backgroundColor: `${theme.colors.info}10`,
                          color: theme.colors.info
                        }}>
                          ID: {paper.id.substring(0, 8)}...
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}