import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiPlay, HiDownload, HiEye, HiClock, HiCheckCircle, HiXCircle, HiRefresh, HiBookmark, HiCheck } from 'react-icons/hi'
import { useTheme } from '../contexts/ThemeContext'
import { usePaperStorage } from '../contexts/PaperStorageContext'
import { apiClient } from '../lib/apiClient'
import toast from 'react-hot-toast'

type Job = { 
  jobId: string
  status: string
  progress: number
  updatedAt?: string
  message?: string
  query?: string
}

type Workspace = {
  id: string
  name: string
  description?: string
}

export default function ResearchJobs() {
  const { theme } = useTheme()
  const { addPaper, addSearchResult, papers } = usePaperStorage()
  const [query, setQuery] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [activeResult, setActiveResult] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null)
  const [pinningPapers, setPinningPapers] = useState<Set<string>>(new Set())
  const [pinnedPapers, setPinnedPapers] = useState<Set<string>>(new Set())
  const [showWorkspaceSelector, setShowWorkspaceSelector] = useState(false)

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces()
  }, [])

  async function loadWorkspaces() {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      const response = await fetch('/api/workspaces', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setWorkspaces(data.workspaces || [])
        // Auto-select first workspace if available
        if (data.workspaces && data.workspaces.length > 0) {
          setSelectedWorkspace(data.workspaces[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error)
    }
  }

  async function pinPaperToWorkspace(paper: any, workspaceId: string) {
    const paperId = paper.id || paper.paperId || paper.title
    setPinningPapers(prev => new Set(prev).add(paperId))

    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        toast.error('Please log in to pin papers')
        return
      }

      const response = await fetch(`/api/workspaces/${workspaceId}/papers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paper_id: paper.id || paper.paperId || `paper_${Date.now()}`,
          title: paper.title || 'Untitled',
          authors: Array.isArray(paper.authors) ? paper.authors : 
                   (paper.authors?.split(', ') || ['Unknown Author']),
          abstract: paper.abstract || '',
          publication_year: paper.year || null,
          journal: paper.publication || paper.venue || '',
          citation_count: paper.citationCount || 0,
          keywords: paper.keywords || [],
          pdf_url: paper.pdfUrl || '',
          paper_url: paper.url || '',
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

  async function onStart() {
    if (!query.trim()) {
      toast.error('Please enter a research query')
      return
    }
    
    setLoading(true)
    const loadingToast = toast.loading('🚀 Starting research job...')
    
    try {
      const res = await apiClient.post('/research/start', { query: query.trim() })
      const job: Job = { 
        jobId: res.jobId, 
        status: 'queued', 
        progress: 0, 
        query: query.trim() 
      }
      setJobs(j => [job, ...j])
      setQuery('')
      toast.dismiss(loadingToast)
      toast.success('Research job started!')
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error('Failed to start research job')
      console.error('Job start error:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    const t = setInterval(async () => {
      const pending = jobs.filter(j => j.status !== 'completed' && j.status !== 'failed')
      if (pending.length === 0) return
      
      const updates = await Promise.all(pending.map(async j => {
        try { 
          return await apiClient.get(`/research/status/${j.jobId}`)
        } catch { 
          return null 
        }
      }))
      
      setJobs(prev => prev.map(j => {
        const u = updates.find(x => x && x.jobId === j.jobId)
        return u ? { 
          ...j,
          status: u.status, 
          progress: Math.round(u.progress || 0), 
          updatedAt: u.updatedAt, 
          message: u.message 
        } : j
      }))
    }, 2000)
    return () => clearInterval(t)
  }, [jobs])

  async function openResults(jobId: string) {
    try {
      const loadingToast = toast.loading('📊 Loading results...')
      const res = await apiClient.get(`/research/results/${jobId}`)
      setActiveResult(res)
      
      // Save papers to persistent storage
      if (res.papersByTopic) {
        const searchResult = {
          id: `search_${Date.now()}`,
          query: jobs.find(j => j.jobId === jobId)?.query || 'Research Results',
          papers: Object.values(res.papersByTopic).flat() as any[],
          timestamp: new Date().toISOString(),
          totalResults: Object.values(res.papersByTopic).flat().length,
          source: 'research-job'
        }
        
        // Add each paper individually and save search result
        searchResult.papers.forEach((paper: any) => {
          const paperToAdd = {
            id: paper.id || `paper_${Date.now()}_${Math.random()}`,
            title: paper.title || 'Untitled',
            authors: paper.authors?.split(', ') || ['Unknown Author'],
            abstract: paper.abstract || '',
            url: paper.url,
            doi: paper.doi,
            venue: paper.publication,
            year: paper.year,
            citations: paper.citationCount,
            pdfUrl: paper.pdfUrl,
            metadata: paper,
            addedAt: new Date().toISOString()
          }
          addPaper(paperToAdd)
        })
        
        addSearchResult(searchResult)
      }
      
      toast.dismiss(loadingToast)
      toast.success('Results loaded and saved!')
    } catch (error) {
      toast.error('Failed to load results')
      console.error('Results error:', error)
    }
  }

  const isPaperSaved = (paper: any) => {
    return papers.some(p => p.id === paper.id || p.title === paper.title)
  }

  const savePaper = (paper: any) => {
    const paperToAdd = {
      id: paper.id || `paper_${Date.now()}_${Math.random()}`,
      title: paper.title || 'Untitled',
      authors: paper.authors?.split(', ') || ['Unknown Author'],
      abstract: paper.abstract || '',
      url: paper.url,
      doi: paper.doi,
      venue: paper.publication,
      year: paper.year,
      citations: paper.citationCount,
      pdfUrl: paper.pdfUrl,
      metadata: paper,
      addedAt: new Date().toISOString()
    }
    addPaper(paperToAdd)
    toast.success('Paper saved!')
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <HiCheckCircle className="h-4 w-4 text-green-400" />
      case 'failed': return <HiXCircle className="h-4 w-4 text-red-400" />
      case 'processing': return <HiRefresh className="h-4 w-4 text-blue-400 animate-spin" />
      default: return <HiClock className="h-4 w-4 text-yellow-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return { bg: `${theme.colors.success}20`, text: theme.colors.success }
      case 'failed': return { bg: `${theme.colors.error}20`, text: theme.colors.error }
      case 'processing': return { bg: `${theme.colors.info}20`, text: theme.colors.info }
      default: return { bg: `${theme.colors.warning}20`, text: theme.colors.warning }
    }
  }

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
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <HiPlay className="h-8 w-8" style={{ color: theme.colors.primary }} />
            </motion.div>
            <h1 className="text-3xl font-bold" style={{ color: theme.colors.textPrimary }}>
              Research Jobs
            </h1>
          </div>
          <p className="text-lg" style={{ color: theme.colors.textSecondary }}>
            Queue and monitor background research tasks with comprehensive analysis
          </p>
        </motion.div>

        {/* Start Job Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl p-6 border"
          style={{ 
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border
          }}
        >
          {/* Workspace Selector */}
          {workspaces.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.textSecondary }}>
                Pin papers to workspace:
              </label>
              <select
                value={selectedWorkspace || ''}
                onChange={(e) => setSelectedWorkspace(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
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
            </div>
          )}
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
            <HiPlay className="h-5 w-5" style={{ color: theme.colors.accent }} />
            Start New Research Job
          </h2>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <textarea 
                value={query} 
                onChange={e => setQuery(e.target.value)} 
                placeholder="Enter your comprehensive research query (e.g., 'machine learning applications in drug discovery with focus on molecular prediction')"
                className="w-full h-24 rounded-lg border p-4 focus:outline-none focus:ring-2 transition-all resize-none"
                style={{
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.textPrimary
                }}
                disabled={loading}
              />
            </div>
            <motion.button 
              onClick={onStart}
              disabled={loading || !query.trim()}
              className="px-8 py-4 rounded-lg font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-start"
              style={{ 
                background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryHover})` 
              }}
              whileHover={{ scale: loading || !query.trim() ? 1 : 1.05 }}
              whileTap={{ scale: loading || !query.trim() ? 1 : 0.95 }}
            >
              <HiPlay className="h-4 w-4" />
              {loading ? 'Starting...' : 'Start Job'}
            </motion.button>
          </div>
        </motion.div>

        {/* Jobs Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold" style={{ color: theme.colors.textPrimary }}>
              Active Jobs
            </h3>
            <span className="px-3 py-1 rounded-full text-sm" style={{
              backgroundColor: `${theme.colors.info}20`,
              color: theme.colors.info
            }}>
              {jobs.length} jobs
            </span>
          </div>

          {jobs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12 rounded-xl border"
              style={{ 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border
              }}
            >
              <motion.div
                animate={{ 
                  y: [0, -10, 0],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-6xl mb-4"
              >
                🚀
              </motion.div>
              <h4 className="text-lg font-medium mb-2" style={{ color: theme.colors.textPrimary }}>
                No research jobs yet
              </h4>
              <p style={{ color: theme.colors.textSecondary }}>
                Start your first research job to see comprehensive analysis results
              </p>
            </motion.div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {jobs.map((job, idx) => (
                  <motion.div 
                    key={job.jobId} 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: idx * 0.05 }} 
                    className="rounded-xl p-5 border hover:shadow-lg transition-all"
                    style={{ 
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <span 
                          className="text-xs px-2 py-1 rounded-full font-medium"
                          style={{
                            backgroundColor: getStatusColor(job.status).bg,
                            color: getStatusColor(job.status).text
                          }}
                        >
                          {job.status}
                        </span>
                      </div>
                      <span className="font-mono text-xs" style={{ color: theme.colors.textMuted }}>
                        {job.jobId.substring(0, 8)}...
                      </span>
                    </div>

                    {/* Query */}
                    {job.query && (
                      <div className="mb-3">
                        <p className="text-sm font-medium line-clamp-2" style={{ color: theme.colors.textPrimary }}>
                          {job.query}
                        </p>
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                          Progress
                        </span>
                        <span className="text-xs font-medium" style={{ color: theme.colors.textPrimary }}>
                          {job.progress || 0}%
                        </span>
                      </div>
                      <div 
                        className="h-2 rounded-full overflow-hidden"
                        style={{ backgroundColor: `${theme.colors.primary}10` }}
                      >
                        <motion.div 
                          className="h-full rounded-full"
                          style={{ 
                            background: `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.accent})` 
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${job.progress || 0}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </div>

                    {/* Timestamp */}
                    {job.updatedAt && (
                      <p className="text-xs mb-3" style={{ color: theme.colors.textMuted }}>
                        Updated: {new Date(job.updatedAt).toLocaleString()}
                      </p>
                    )}

                    {/* Message */}
                    {job.message && (
                      <p className="text-xs mb-3 p-2 rounded" style={{ 
                        backgroundColor: `${theme.colors.info}10`,
                        color: theme.colors.textSecondary 
                      }}>
                        {job.message}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <motion.button
                        onClick={() => openResults(job.jobId)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg font-medium text-white"
                        style={{ 
                          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryHover})` 
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <HiEye className="h-3 w-3" />
                        Results
                      </motion.button>
                      
                      <div className="flex gap-1">
                        {['json', 'csv', 'bibtex'].map((format) => (
                          <motion.a
                            key={format}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg font-medium transition-colors"
                            style={{
                              backgroundColor: `${theme.colors.accent}20`,
                              color: theme.colors.accent
                            }}
                            href={`/api/export/${format}/${job.jobId}`}
                            target="_blank"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <HiDownload className="h-3 w-3" />
                            {format.toUpperCase()}
                          </motion.a>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Results Modal */}
        <AnimatePresence>
          {activeResult && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center p-6 z-50" 
              onClick={() => setActiveResult(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="rounded-xl max-w-6xl w-full max-h-[80vh] overflow-auto p-6 border"
                style={{ 
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold" style={{ color: theme.colors.textPrimary }}>
                    Research Results
                  </h3>
                  <motion.button
                    onClick={() => setActiveResult(null)}
                    className="px-3 py-1.5 rounded-lg transition-colors"
                    style={{
                      backgroundColor: `${theme.colors.error}20`,
                      color: theme.colors.error
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Close
                  </motion.button>
                </div>

                {/* Results Content */}
                <div className="space-y-6">
                  {/* Query */}
                  <div>
                    <h4 className="text-sm font-medium mb-2" style={{ color: theme.colors.textSecondary }}>
                      Research Query
                    </h4>
                    <p className="font-medium p-3 rounded-lg" style={{ 
                      backgroundColor: theme.colors.background,
                      color: theme.colors.textPrimary 
                    }}>
                      {activeResult.query}
                    </p>
                  </div>

                  {/* Summary */}
                  {activeResult.analysis?.summary && (
                    <div>
                      <h4 className="text-sm font-medium mb-2" style={{ color: theme.colors.textSecondary }}>
                        AI Summary
                      </h4>
                      <div className="p-4 rounded-lg whitespace-pre-wrap" style={{ 
                        backgroundColor: theme.colors.background,
                        color: theme.colors.textPrimary 
                      }}>
                        {activeResult.analysis.summary}
                      </div>
                    </div>
                  )}

                  {/* Papers by Topic */}
                  <div>
                    <h4 className="text-sm font-medium mb-4" style={{ color: theme.colors.textSecondary }}>
                      Research Papers by Topic
                    </h4>
                    <div className="space-y-6">
                      {Object.entries(activeResult.papersByTopic || {}).map(([topic, papers]: any, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                        >
                          <h5 className="font-semibold mb-3 flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
                            <span 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: theme.colors.accent }}
                            />
                            {topic}
                            <span 
                              className="px-2 py-0.5 text-xs rounded-full"
                              style={{
                                backgroundColor: `${theme.colors.info}20`,
                                color: theme.colors.info
                              }}
                            >
                              {papers.length} papers
                            </span>
                          </h5>
                          <div className="grid gap-3">
                            {(papers as any[]).map((paper, k) => (
                              <motion.div 
                                key={k} 
                                className="p-4 rounded-lg border hover:shadow-sm transition-all"
                                style={{ 
                                  backgroundColor: theme.colors.background,
                                  borderColor: theme.colors.border
                                }}
                                whileHover={{ scale: 1.01 }}
                              >
                                <h6 className="font-medium mb-2" style={{ color: theme.colors.textPrimary }}>
                                  {paper.title}
                                </h6>
                                <p className="text-xs mb-3" style={{ color: theme.colors.textSecondary }}>
                                  {paper.authors || "Unknown Authors"} · {paper.year || "Unknown Year"} · {paper.publication || "Unknown Publication"} · Citations: {paper.citationCount || 0}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {/* Pin to Workspace Button */}
                                  {selectedWorkspace && (
                                    <motion.button
                                      onClick={() => pinPaperToWorkspace(paper, selectedWorkspace)}
                                      disabled={pinningPapers.has(paper.id || paper.title) || pinnedPapers.has(paper.id || paper.title)}
                                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      style={{
                                        backgroundColor: pinnedPapers.has(paper.id || paper.title) 
                                          ? `${theme.colors.success}20` 
                                          : `${theme.colors.accent}20`,
                                        color: pinnedPapers.has(paper.id || paper.title) 
                                          ? theme.colors.success 
                                          : theme.colors.accent
                                      }}
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                    >
                                      {pinningPapers.has(paper.id || paper.title) ? (
                                        <>
                                          <HiRefresh className="h-3 w-3 animate-spin" />
                                          Pinning...
                                        </>
                                      ) : pinnedPapers.has(paper.id || paper.title) ? (
                                        <>
                                          <HiCheck className="h-3 w-3" />
                                          Pinned
                                        </>
                                      ) : (
                                        <>
                                          <HiBookmark className="h-3 w-3" />
                                          Pin to Workspace
                                        </>
                                      )}
                                    </motion.button>
                                  )}
                                  {paper.url && (
                                    <a 
                                      className="text-xs px-2 py-1 rounded-full transition-colors"
                                      style={{
                                        backgroundColor: `${theme.colors.primary}20`,
                                        color: theme.colors.primary
                                      }}
                                      href={paper.url} 
                                      target="_blank"
                                    >
                                      View Paper
                                    </a>
                                  )}
                                  {paper.pdfUrl && (
                                    <a 
                                      className="text-xs px-2 py-1 rounded-full transition-colors"
                                      style={{
                                        backgroundColor: `${theme.colors.error}20`,
                                        color: theme.colors.error
                                      }}
                                      href={paper.pdfUrl} 
                                      target="_blank"
                                    >
                                      PDF
                                    </a>
                                  )}
                                  {paper.doi && (
                                    <a 
                                      className="text-xs px-2 py-1 rounded-full transition-colors"
                                      style={{
                                        backgroundColor: `${theme.colors.accent}20`,
                                        color: theme.colors.accent
                                      }}
                                      href={`https://doi.org/${paper.doi}`} 
                                      target="_blank"
                                    >
                                      DOI
                                    </a>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}