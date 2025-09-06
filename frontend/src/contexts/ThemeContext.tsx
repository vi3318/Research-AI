import React, { createContext, useContext, useEffect, useState } from 'react'

export interface Theme {
  name: string
  colors: {
    background: string
    surface: string
    primary: string
    primaryHover: string
    secondary: string
    accent: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    border: string
    highlight: string
    error: string
    warning: string
    success: string
    info: string
  }
  typography: {
    fontFamily: string
    fontSizeBase: string
    headings: {
      h1: { fontSize: string; fontWeight: number }
      h2: { fontSize: string; fontWeight: number }
      h3: { fontSize: string; fontWeight: number }
      h4: { fontSize: string; fontWeight: number }
    }
    body: {
      fontSize: string
      lineHeight: string
    }
  }
  spacing: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
  }
  radii: {
    sm: string
    md: string
    lg: string
    full: string
  }
  shadows: {
    sm: string
    md: string
    lg: string
  }
}

export const lightTheme: Theme = {
  name: "ResearchAI Light Theme",
  colors: {
    background: "#FFFFFF",
    surface: "#F9FAFB",
    primary: "#2563EB",
    primaryHover: "#1D4ED8",
    secondary: "#6B7280",
    accent: "#10B981",
    textPrimary: "#1F2937",
    textSecondary: "#4B5563",
    textMuted: "#9CA3AF",
    border: "#E5E7EB",
    highlight: "#3B82F6",
    error: "#EF4444",
    warning: "#F59E0B",
    success: "#22C55E",
    info: "#0EA5E9"
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    fontSizeBase: "16px",
    headings: {
      h1: { fontSize: "2rem", fontWeight: 700 },
      h2: { fontSize: "1.5rem", fontWeight: 600 },
      h3: { fontSize: "1.25rem", fontWeight: 600 },
      h4: { fontSize: "1.125rem", fontWeight: 500 }
    },
    body: {
      fontSize: "1rem",
      lineHeight: "1.6"
    }
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px"
  },
  radii: {
    sm: "4px",
    md: "8px",
    lg: "16px",
    full: "9999px"
  },
  shadows: {
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 6px rgba(0,0,0,0.1)",
    lg: "0 10px 15px rgba(0,0,0,0.1)"
  }
}

export const darkTheme: Theme = {
  name: "ResearchAI Dark Theme",
  colors: {
    background: "#0D1117",
    surface: "#161B22",
    primary: "#3B82F6", 
    primaryHover: "#2563EB",
    secondary: "#8B949E",
    accent: "#10B981",
    textPrimary: "#F0F6FC",
    textSecondary: "#8B949E",
    textMuted: "#6E7681",
    border: "#30363D",
    highlight: "#58A6FF",
    error: "#EF4444",
    warning: "#FBBF24",
    success: "#22C55E",
    info: "#38BDF8"
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    fontSizeBase: "16px",
    headings: {
      h1: { fontSize: "2rem", fontWeight: 700 },
      h2: { fontSize: "1.5rem", fontWeight: 600 },
      h3: { fontSize: "1.25rem", fontWeight: 600 },
      h4: { fontSize: "1.125rem", fontWeight: 500 }
    },
    body: {
      fontSize: "1rem",
      lineHeight: "1.6"
    }
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px"
  },
  radii: {
    sm: "4px",
    md: "8px",
    lg: "16px",
    full: "9999px"
  },
  shadows: {
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 6px rgba(0,0,0,0.1)",
    lg: "0 10px 15px rgba(0,0,0,0.1)"
  }
}

interface ThemeContextType {
  theme: Theme
  isDark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const theme = isDark ? darkTheme : lightTheme

  const toggleTheme = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light')
  }

  // Apply CSS custom properties
  useEffect(() => {
    const root = document.documentElement
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value)
    })
    
    // Apply typography
    root.style.setProperty('--font-family', theme.typography.fontFamily)
    root.style.setProperty('--font-size-base', theme.typography.fontSizeBase)
    
    // Apply spacing
    Object.entries(theme.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, value)
    })
    
    // Apply radii
    Object.entries(theme.radii).forEach(([key, value]) => {
      root.style.setProperty(`--radius-${key}`, value)
    })
    
    // Apply shadows
    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value)
    })

    // Update body class for theme
    document.body.className = isDark ? 'dark-theme' : 'light-theme'
  }, [theme, isDark])

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}