import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const workspacePackages = [
  '@flowtap/api-core',
  '@flowtap/shared',
  '@flowtap/ui-core',
  '@flowtap/store',
  '@flowtap/pages-core',
]

export default defineConfig({
  plugins: [react()],
  server: { port: 3001 },
  optimizeDeps: {
    exclude: workspacePackages,
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom', 'react-redux'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          redux:  ['@reduxjs/toolkit', 'react-redux'],
        },
      },
    },
  },
})
