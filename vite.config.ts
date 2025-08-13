import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/predict': 'http://localhost:5000',
      '/reports': 'http://localhost:5000',
      '/complaints': 'http://localhost:5000'
    }
  }
});
