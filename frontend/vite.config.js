import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9000,
    host: true, // allow ngrok/network access
    allowedHosts: ['.ngrok-free.dev', '.ngrok.io', '.ngrok-free.app','app.mafmedia.space'],
    proxy: {
      '/api': {
        target: 'https://api.mafmedia.space/',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'https://api.mafmedia.space/',
        changeOrigin: true,
        ws: true,
        secure: true,
      },
    },
  },
});
