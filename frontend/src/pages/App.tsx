import { Route, Routes, NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { HiSun, HiMoon } from 'react-icons/hi'
import { useTheme } from '../contexts/ThemeContext'
import { AuthProvider } from '../contexts/AuthContext'
import { PaperStorageProvider } from '../contexts/PaperStorageContext'
import { ChatProvider } from '../contexts/ChatContext'
import UserMenu from '../components/UserMenu'
import ProtectedRoute from '../components/ProtectedRoute'
import ResearchJobs from './ResearchJobs'
import SemanticSearch from './SemanticSearch' // New semantic search with vector DB
import Literature from './Literature'
import Chat from './Chat'
import ChatNew from './ChatNew'
import SimpleChat from './SimpleChat'
import EnhancedChat from './EnhancedChat'
import Presentation from './Presentation'
import WorkspacePage from './WorkspacePage'
import DocumentEditor from './DocumentEditor'
import WorkspaceList from './WorkspaceList'
import QAHelp from './QAHelp'
import { RMRIDashboard } from '../components/RMRI'
import DocEditorProduction from '../components/DocEditorProduction'

export default function App() {
  const { theme, isDark, toggleTheme } = useTheme()
  
  const tabs = [
    { to: '/', label: 'Research Assistant' },
    { to: '/semantic', label: 'Semantic Search' },
    { to: '/presentation', label: 'Presentation' },
    { to: '/workspace', label: 'Workspace' },
    { to: '/rmri', label: '🤖 RMRI Agent' },
    { to: '/chat', label: 'Chat' },
  ]
  
  return (
    <AuthProvider>
      <PaperStorageProvider>
        <ChatProvider>
          <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
          <header className="sticky top-0 z-40 backdrop-blur border-b" style={{ 
            backgroundColor: `${theme.colors.surface}70`, 
            borderColor: theme.colors.border 
          }}>
            <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
              <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 animate-pulse" />
                <div className="text-xl font-semibold" style={{ color: theme.colors.textPrimary }}>ResearchAI</div>
              </motion.div>
              <nav className="flex items-center gap-2">
                {tabs.map(t => (
                  <NavLink 
                    key={t.to} 
                    to={t.to} 
                    end 
                    className={({ isActive }) => (
                    `px-3 py-2 rounded-md transition-colors ${isActive ? '' : ''}`
                  )}
                  style={({ isActive }) => ({
                  backgroundColor: isActive ? `${theme.colors.primary}20` : 'transparent',
                  color: isActive ? theme.colors.primary : theme.colors.textSecondary
                })}
              >
                {t.label}
              </NavLink>
            ))}
            <div className="ml-4 flex items-center gap-3">
              <motion.button
                onClick={toggleTheme}
                className="p-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: `${theme.colors.primary}20`,
                  color: theme.colors.primary
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${theme.colors.primary}30`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = `${theme.colors.primary}20`
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? (
                  <HiSun className="h-5 w-5" style={{ color: theme.colors.warning }} />
                ) : (
                  <HiMoon className="h-5 w-5" style={{ color: theme.colors.textSecondary }} />
                )}
              </motion.button>
              <UserMenu />
            </div>
          </nav>
        </div>
      </header>
      <main className={`${
        window.location.pathname === '/' || window.location.pathname === '/chat' || window.location.pathname === '/enhanced'
          ? '' 
          : 'mx-auto max-w-7xl px-6 py-8'
      }`}>
        <Routes>
          <Route path="/" element={<ProtectedRoute><EnhancedChat /></ProtectedRoute>} />
          <Route path="/research" element={<ProtectedRoute><ResearchJobs /></ProtectedRoute>} />
          <Route path="/semantic" element={<ProtectedRoute><SemanticSearch /></ProtectedRoute>} />
          <Route path="/presentation" element={<ProtectedRoute><Presentation /></ProtectedRoute>} />
          <Route path="/workspace" element={<ProtectedRoute><WorkspaceList /></ProtectedRoute>} />
          <Route path="/workspace/:workspaceId" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
          <Route path="/workspace/:workspaceId/document/:documentId" element={<ProtectedRoute><DocEditorProduction /></ProtectedRoute>} />
          <Route path="/workspace/:workspaceId/editor/:documentId?" element={<ProtectedRoute><DocumentEditor /></ProtectedRoute>} />
          <Route path="/rmri" element={<ProtectedRoute><RMRIDashboard /></ProtectedRoute>} />
          <Route path="/chat" element={<SimpleChat />} />
          <Route path="/enhanced" element={<ProtectedRoute><EnhancedChat /></ProtectedRoute>} />
          <Route path="/docs" element={<QAHelp />} />
        </Routes>
      </main>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(30, 41, 59, 0.9)',
            color: '#e2e8f0',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            backdropFilter: 'blur(8px)',
          },
        }}
      />
        </div>
        </ChatProvider>
      </PaperStorageProvider>
    </AuthProvider>
  )
}

