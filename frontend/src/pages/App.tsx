import { Route, Routes, NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useUser, SignInButton, UserButton } from '@clerk/clerk-react'
import { Toaster } from 'react-hot-toast'
import { HiSun, HiMoon } from 'react-icons/hi'
import { useTheme } from '../contexts/ThemeContext'
import ResearchJobs from './ResearchJobs'
import Semantic from './Semantic'
import Literature from './Literature'
import Chat from './Chat'
import EnhancedChat from './EnhancedChat'
import Presentation from './Presentation'

export default function App() {
  const { user, isLoaded } = useUser()
  const { theme, isDark, toggleTheme } = useTheme()
  
  const tabs = [
    { to: '/', label: 'Research Assistant' },
    { to: '/research', label: 'Research Jobs' },
    { to: '/semantic', label: 'Semantic Search' },
    { to: '/presentation', label: 'Presentation' },
  ]
  return (
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
            <a 
              className="px-3 py-2 rounded-md transition-colors" 
              href="/api/docs" 
              target="_blank"
              style={{ color: theme.colors.textSecondary }}
            >
              Docs
            </a>
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
              {isLoaded && user ? (
                <UserButton afterSignOutUrl="/" />
              ) : isLoaded ? (
                <SignInButton mode="modal">
                  <button className="btn-sm">Sign In</button>
                </SignInButton>
              ) : null}
            </div>
          </nav>
        </div>
      </header>
      <main className={`${window.location.pathname === '/' ? '' : 'mx-auto max-w-7xl px-6 py-8'}`}>
        <Routes>
          <Route path="/" element={<EnhancedChat />} />
          <Route path="/research" element={<ResearchJobs />} />
          <Route path="/semantic" element={<Semantic />} />
          <Route path="/presentation" element={<Presentation />} />
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
  )
}

