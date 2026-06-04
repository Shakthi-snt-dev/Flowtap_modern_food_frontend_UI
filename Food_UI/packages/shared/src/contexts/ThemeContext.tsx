import React, { createContext, useContext, useEffect } from 'react'
import { useAppSelector, useAppDispatch, setTheme } from '@flowtap/store'

interface ThemeContextValue {
  isDark: boolean
  toggle: () => void
}

const FONT_MAP: Record<string, string> = {
  inter:     "'Inter', sans-serif",
  poppins:   "'Poppins', sans-serif",
  roboto:    "'Roboto', sans-serif",
  'dm-sans': "'DM Sans', sans-serif",
  nunito:    "'Nunito', sans-serif",
}

const ALWAYS_DARK_THEMES = new Set(['midnight', 'cosmic', 'galaxy', 'obsidian', 'neon', 'crimson', 'noir', 'jet-black'])

const ThemeContext = createContext<ThemeContextValue>({ isDark: false, toggle: () => {} })

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch       = useAppDispatch()
  const theme          = useAppSelector((s) => s.ui.theme)
  const colorTheme     = useAppSelector((s) => s.ui.colorTheme)
  const accentColor    = useAppSelector((s) => s.ui.accentColor)
  const fontFamily     = useAppSelector((s) => s.ui.fontFamily)
  const borderRadius   = useAppSelector((s) => s.ui.borderRadius)
  const sidebarDensity = useAppSelector((s) => s.ui.sidebarDensity)

  const resolveIsDark = () => {
    if (ALWAYS_DARK_THEMES.has(colorTheme)) return true
    if (theme === 'dark') return true
    if (theme === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches
    return false
  }

  const isDark = resolveIsDark()

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark)
    root.setAttribute('data-color-theme', colorTheme)
    root.setAttribute('data-accent',      accentColor)
    root.setAttribute('data-radius',      borderRadius)
    root.setAttribute('data-density',     sidebarDensity)
    root.style.setProperty('--app-font',  FONT_MAP[fontFamily] ?? FONT_MAP.inter)
  }, [isDark, colorTheme, accentColor, fontFamily, borderRadius, sidebarDensity])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => document.documentElement.classList.toggle('dark', e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const toggle = () => dispatch(setTheme(isDark ? 'light' : 'dark'))

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
