import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Keep long-lived vendor and dynamically imported feature chunks cacheable
        // independently. Dynamic feature imports retain their entry names (for
        // example, TimelineView-[hash].js) without bundling inactive tabs into the app entry.
        chunkFileNames: 'assets/[name]-[hash].js',
        manualChunks: {
          // Vendor chunk for React and related libraries
          'react-vendor': ['react', 'react-dom'],
          // Firebase as separate chunk (large dependency)
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
        },
      },
    },
    // Improve chunk size warnings threshold
    chunkSizeWarningLimit: 1000,
  },
})
