import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      // Leave VITE_API_BASE_URL empty in dev: the browser calls /api on this origin and Vite forwards it to Spring Boot.
      // Same-origin => no CORS setup needed and the SameSite=Strict refresh cookie works.
      proxy: { '/api': { target: env.VITE_DEV_PROXY_TARGET || 'http://localhost:8081', changeOrigin: true } },
    },
  };
});
