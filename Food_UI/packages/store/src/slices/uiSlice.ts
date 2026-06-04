import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface UiState {
  sidebarOpen: boolean
  theme: 'light' | 'dark' | 'system'
  colorTheme: string
  isOffline: boolean
  accentColor: string
  fontFamily: string
  borderRadius: string
  sidebarDensity: string
}

function persist(key: string, value: string) {
  localStorage.setItem(key, value)
}

const initialState: UiState = {
  sidebarOpen: true,
  theme: (localStorage.getItem('theme') as 'light' | 'dark' | 'system') ?? 'light',
  colorTheme: localStorage.getItem('colorTheme') ?? 'food-light',    // Food UI default
  isOffline: false,
  accentColor: localStorage.getItem('accentColor') ?? 'food-orange', // Food UI default
  fontFamily: localStorage.getItem('fontFamily') ?? 'inter',
  borderRadius: localStorage.getItem('borderRadius') ?? 'normal',
  sidebarDensity: localStorage.getItem('sidebarDensity') ?? 'comfortable',
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) { state.sidebarOpen = !state.sidebarOpen },
    setSidebar(state, action: PayloadAction<boolean>) { state.sidebarOpen = action.payload },
    setTheme(state, action: PayloadAction<'light' | 'dark' | 'system'>) {
      state.theme = action.payload
      persist('theme', action.payload)
    },
    setColorTheme(state, action: PayloadAction<string>) {
      state.colorTheme = action.payload
      persist('colorTheme', action.payload)
    },
    setOffline(state, action: PayloadAction<boolean>) { state.isOffline = action.payload },
    setAccentColor(state, action: PayloadAction<string>) {
      state.accentColor = action.payload
      persist('accentColor', action.payload)
    },
    setFontFamily(state, action: PayloadAction<string>) {
      state.fontFamily = action.payload
      persist('fontFamily', action.payload)
    },
    setBorderRadius(state, action: PayloadAction<string>) {
      state.borderRadius = action.payload
      persist('borderRadius', action.payload)
    },
    setSidebarDensity(state, action: PayloadAction<string>) {
      state.sidebarDensity = action.payload
      persist('sidebarDensity', action.payload)
    },
    applyAppearance(state, action: PayloadAction<{
      themeMode?: string; colorTheme?: string; accentColor?: string
      fontFamily?: string; borderRadius?: string; sidebarDensity?: string
    }>) {
      const a = action.payload
      if (a.themeMode)      { state.theme = a.themeMode as 'light' | 'dark' | 'system'; persist('theme', a.themeMode) }
      if (a.colorTheme)     { state.colorTheme = a.colorTheme; persist('colorTheme', a.colorTheme) }
      if (a.accentColor)    { state.accentColor = a.accentColor; persist('accentColor', a.accentColor) }
      if (a.fontFamily)     { state.fontFamily = a.fontFamily; persist('fontFamily', a.fontFamily) }
      if (a.borderRadius)   { state.borderRadius = a.borderRadius; persist('borderRadius', a.borderRadius) }
      if (a.sidebarDensity) { state.sidebarDensity = a.sidebarDensity; persist('sidebarDensity', a.sidebarDensity) }
    },
  },
})

export const {
  toggleSidebar, setSidebar, setTheme, setColorTheme, setOffline,
  setAccentColor, setFontFamily, setBorderRadius, setSidebarDensity, applyAppearance,
} = uiSlice.actions
export default uiSlice.reducer
