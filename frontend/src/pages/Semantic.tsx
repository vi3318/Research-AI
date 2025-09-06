import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiSearch, HiSparkles, HiLightBulb, HiBeaker } from 'react-icons/hi'
import { useTheme } from '../contexts/ThemeContext'
import { semanticIndex, semanticQuery } from '../lib/api'
import toast from 'react-hot-toast'

export default function Semantic() {
  const { theme } = useTheme()
  const [namespace, setNamespace] = useState('papers')
  const [raw, setRaw] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchType, setSearchType] = useState<'semantic' | 'conceptual' | 'contextual'>('semantic')
  
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
    } catch (e) {
      toast.error('Indexing failed')
    }
  }

  async function onQuery() {
    if (!query.trim()) return
    
    setLoading(true)
    const loadingToast = toast.loading('🔍 Performing semantic search...')
    
    try {
      const res = await semanticQuery(namespace, query, 10)
      setResults(res.results || [])
      toast.dismiss(loadingToast)
      toast.success(`Found ${res.results?.length || 0} semantically similar results!`)
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
      </div>
    </div>
  )
}