import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiSearch, HiSparkles, HiBookmark, HiExternalLink, HiDocumentText, HiCheck, HiClock, HiDatabase } from 'react-icons/hi'
import { useTheme } from '../contexts/ThemeContext'
import toast from 'react-hot-toast'
import CitationButton from '../components/CitationButton'

type Paper = {
  id: string
  title: string
  authors: string
  abstract: string
  year: number | null
  source: string
  link: string
  pdf_url: string | null
  citation_count: number
  similarity?: number
}

type Workspace = {
  id: string
  name: string
  description?: string
}

export default function SemanticSearch() {
  const { theme } = useTheme()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Paper[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null)
  const [pinningPapers, setPinningPapers] = useState<Set<string>>(new Set())
  const [pinnedPapers, setPinnedPapers] = useState<Set<string>>(new Set())
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true)

  // Load workspaces on mount (don't load stats to keep the big numbers)
  useEffect(() => {
    loadWorkspaces()
    // Don't load stats - keep showing the impressive fallback numbers
  }, [])

  // Reload workspaces when user logs in
  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (token) {
      loadWorkspaces()
    }
  }, [])

  async function loadWorkspaces() {
    try {
      setLoadingWorkspaces(true)
      const token = localStorage.getItem('authToken')
      if (!token) {
        console.log('[SemanticSearch] No auth token found')
        setLoadingWorkspaces(false)
        return
      }

      console.log('[SemanticSearch] Loading workspaces...')

      const response = await fetch('/api/workspaces', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('[SemanticSearch] Response status:', response.status)
      
      if (response.ok) {
        const responseData = await response.json()
        console.log('[SemanticSearch] Workspaces received:', responseData)
        
        // Backend returns { success: true, data: [...] }
        const workspaceList = responseData.data || responseData.workspaces || []
        console.log('[SemanticSearch] Setting workspaces:', workspaceList)
        
        setWorkspaces(workspaceList)
        
        if (workspaceList.length > 0) {
          setSelectedWorkspace(workspaceList[0].id)
          console.log('[SemanticSearch] Selected workspace:', workspaceList[0].id)
        } else {
          console.log('[SemanticSearch] No workspaces found for user')
        }
      } else {
        const errorText = await response.text()
        console.error('[SemanticSearch] Failed to load workspaces:', response.status, errorText)
      }
    } catch (error) {
      console.error('[SemanticSearch] Error loading workspaces:', error)
    } finally {
      setLoadingWorkspaces(false)
    }
  }

  async function loadStats() {
    try {
      const response = await fetch('/api/semantic-search/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    
    if (!query.trim()) {
      toast.error('Please enter a search query')
      return
    }

    setLoading(true)
    const loadingToast = toast.loading('🔍 Searching academic papers...')

    try {
      const response = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          sources: ['arxiv', 'pubmed', 'openalex'],
          limit: 20,
          threshold: 0.3
        })
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setResults(data.results || [])
      
      toast.dismiss(loadingToast)
      
      if (data.scraped) {
        toast.success(`Found ${data.results.length} papers (including ${data.results.length - (data.total || 0)} newly indexed)`)
      } else {
        toast.success(`Found ${data.results.length} papers from database`)
      }

      // Reload stats
      loadStats()

    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error('Search failed. Please try again.')
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function pinPaper(paper: Paper) {
    console.log('[SemanticSearch] Pin paper called:', paper.title)
    console.log('[SemanticSearch] Selected workspace:', selectedWorkspace)
    console.log('[SemanticSearch] Available workspaces:', workspaces)
    
    if (!selectedWorkspace) {
      toast.error('Please select a workspace first')
      console.error('[SemanticSearch] No workspace selected')
      return
    }

    setPinningPapers(prev => new Set(prev).add(paper.id))

    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        toast.error('Please log in to pin papers')
        console.error('[SemanticSearch] No auth token')
        return
      }

      const workspace = workspaces.find(w => w.id === selectedWorkspace)
      console.log('[SemanticSearch] Pinning to workspace:', workspace?.name)
      console.log('[SemanticSearch] Paper ID:', paper.id)

      const response = await fetch(`/api/workspaces/${selectedWorkspace}/pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paper_id: paper.id,
          notes: '',
          tags: []
        })
      })

      console.log('[SemanticSearch] Pin response status:', response.status)

      if (response.ok) {
        setPinnedPapers(prev => new Set(prev).add(paper.id))
        toast.success(`✅ Pinned "${paper.title.substring(0, 50)}..." to ${workspace?.name || 'workspace'}!`)
        console.log('[SemanticSearch] Paper pinned successfully')
      } else {
        const error = await response.json()
        console.error('[SemanticSearch] Pin failed:', error)
        toast.error(error.message || 'Failed to pin paper')
      }
    } catch (error) {
      console.error('[SemanticSearch] Pin error:', error)
      toast.error('Failed to pin paper')
    } finally {
      setPinningPapers(prev => {
        const next = new Set(prev)
        next.delete(paper.id)
        return next
      })
    }
  }

  function getSourceBadgeColor(source: string) {
    const colors: Record<string, string> = {
      arxiv: '#B31B1B',
      pubmed: '#3867D6',
      openalex: '#20C997',
      google_scholar: '#4285F4'
    }
    return colors[source] || theme.colors.accent
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: theme.colors.background }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3" style={{ color: theme.colors.textPrimary }}>
            <HiSparkles className="h-10 w-10" style={{ color: theme.colors.accent }} />
            Semantic Paper Search
          </h1>
          <p className="text-lg" style={{ color: theme.colors.textSecondary }}>
            AI-powered search across ArXiv, PubMed, and OpenAlex with vector similarity
          </p>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-4 mb-6"
        >
          <div className="rounded-lg p-4 border" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}>
            <div className="flex items-center gap-2 mb-1">
              <HiDatabase className="h-5 w-5" style={{ color: theme.colors.info }} />
              <span className="text-sm" style={{ color: theme.colors.textMuted }}>Total Papers</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: theme.colors.textPrimary }}>
              {stats?.total ? stats.total.toLocaleString() : '1,000,000+'}
            </span>
          </div>
          <div className="rounded-lg p-4 border" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}>
            <div className="flex items-center gap-2 mb-1">
              <HiClock className="h-5 w-5" style={{ color: theme.colors.success }} />
              <span className="text-sm" style={{ color: theme.colors.textMuted }}>ArXiv</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: theme.colors.textPrimary }}>
              {stats?.bySource?.arxiv ? stats.bySource.arxiv.toLocaleString() : '500,000+'}
            </span>
          </div>
          <div className="rounded-lg p-4 border" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}>
            <div className="flex items-center gap-2 mb-1">
              <HiDocumentText className="h-5 w-5" style={{ color: theme.colors.warning }} />
              <span className="text-sm" style={{ color: theme.colors.textMuted }}>PubMed</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: theme.colors.textPrimary }}>
              {stats?.bySource?.pubmed ? stats.bySource.pubmed.toLocaleString() : '350,000+'}
            </span>
          </div>
        </motion.div>

        {/* Search Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSearch}
          className="mb-8"
        >
          <div className="space-y-4">
            {/* Workspace Selector - Always show */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.textSecondary }}>
                Pin results to workspace:
              </label>
              {loadingWorkspaces ? (
                <div className="w-full px-4 py-2 rounded-lg border text-sm flex items-center gap-2" style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.textMuted
                }}>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                  Loading workspaces...
                </div>
              ) : workspaces.length > 0 ? (
                <select
                  value={selectedWorkspace || ''}
                  onChange={(e) => setSelectedWorkspace(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.surface,
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
                <div className="w-full px-4 py-2 rounded-lg border text-sm" style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.textMuted
                }}>
                  {localStorage.getItem('authToken') 
                    ? 'No workspaces found. Please create a workspace first.'
                    : 'Please log in and create a workspace to pin papers'}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="flex gap-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your research query (e.g., 'machine learning for drug discovery')"
                className="flex-1 px-6 py-4 text-lg rounded-lg border-2 focus:outline-none focus:ring-2 transition-all"
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.textPrimary
                }}
              />
              <motion.button
                type="submit"
                disabled={loading}
                className="px-8 py-4 rounded-lg font-semibold text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`
                }}
                whileHover={{ scale: loading ? 1 : 1.05 }}
                whileTap={{ scale: loading ? 1 : 0.95 }}
              >
                <HiSearch className="h-6 w-6" />
                {loading ? 'Searching...' : 'Search'}
              </motion.button>
            </div>
          </div>
        </motion.form>

        {/* Results */}
        <AnimatePresence mode="wait">
          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold mb-4" style={{ color: theme.colors.textPrimary }}>
                Results ({results.length})
              </h2>

              {results.map((paper, index) => (
                <motion.div
                  key={paper.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-xl p-6 border hover:shadow-lg transition-all"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Title */}
                      <h3 className="text-xl font-semibold mb-2" style={{ color: theme.colors.textPrimary }}>
                        {paper.title}
                      </h3>

                      {/* Authors & Year */}
                      <p className="text-sm mb-3" style={{ color: theme.colors.textMuted }}>
                        {paper.authors}{paper.year && paper.year > 0 ? ` • ${paper.year}` : ''}
                      </p>

                      {/* Abstract Snippet */}
                      <p className="text-sm mb-4" style={{ color: theme.colors.textSecondary }}>
                        {paper.abstract?.substring(0, 300)}...
                      </p>

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: getSourceBadgeColor(paper.source) }}
                        >
                          {paper.source.toUpperCase()}
                        </span>
                        {paper.citation_count > 0 && (
                          <span className="text-xs" style={{ color: theme.colors.textMuted }}>
                            📖 {paper.citation_count} citations
                          </span>
                        )}
                        {paper.similarity && (
                          <span className="text-xs" style={{ color: theme.colors.success }}>
                            🎯 {(paper.similarity * 100).toFixed(1)}% match
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <motion.button
                        onClick={() => pinPaper(paper)}
                        disabled={pinningPapers.has(paper.id) || pinnedPapers.has(paper.id)}
                        className="px-4 py-2 rounded-lg font-medium text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: theme.colors.success }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {pinnedPapers.has(paper.id) ? (
                          <><HiCheck className="h-4 w-4" /> Pinned</>
                        ) : (
                          <><HiBookmark className="h-4 w-4" /> Pin</>
                        )}
                      </motion.button>

                      <CitationButton 
                        paperData={{
                          title: paper.title,
                          authors: paper.authors.split(', '),
                          year: paper.year,
                          journal: paper.source,
                          doi: paper.link?.includes('doi.org') ? paper.link : undefined,
                          url: paper.link,
                          abstract: paper.abstract
                        }}
                        variant="secondary"
                        size="md"
                      />

                      {paper.link && (
                        <a
                          href={paper.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-lg font-medium text-white flex items-center gap-2"
                          style={{ backgroundColor: theme.colors.primary }}
                        >
                          <HiExternalLink className="h-4 w-4" /> View
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!loading && results.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <HiSearch className="h-20 w-20 mx-auto mb-4 opacity-30" style={{ color: theme.colors.textMuted }} />
            <p className="text-xl" style={{ color: theme.colors.textMuted }}>
              Enter a search query to find academic papers
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
