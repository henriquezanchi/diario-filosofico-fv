import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas em arquivos próprios: mudam raramente e ficam no cache
        // do navegador entre um deploy e outro do app.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/@zxing/')) return undefined; // leitor de código de barras: carregado sob demanda
          if (id.includes('/firebase/') || id.includes('/@firebase/') || id.includes('/idb/')) return 'firebase';
          if (id.includes('/react') || id.includes('/scheduler/')) return 'react';
          return 'vendor';
        },
      },
    },
  },
})
