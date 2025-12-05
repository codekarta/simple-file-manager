import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3011',
      '/thumb': 'http://localhost:3011',
      '/admin': 'http://localhost:3011',
      // Proxy requests for common file types (images, documents, media)
      // These are uploaded files served from the backend
      '^/.*\\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|tif|ico|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md|rtf|csv|mp4|mp3|wav|mov|avi|mkv|zip|rar|7z|tar|gz)$': {
        target: 'http://localhost:3011',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: false, // Preserve api-docs.html, ads-logo.svg, etc.
    rollupOptions: {
      output: {
        // Clean asset names
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})
