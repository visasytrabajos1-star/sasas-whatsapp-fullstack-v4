import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  if (mode !== 'production') {
    console.log('Build mode:', mode);
    console.log('VITE_SUPABASE_URL configured?:', Boolean(env.VITE_SUPABASE_URL));
    console.log('VITE_SUPABASE_ANON_KEY configured?:', Boolean(env.VITE_SUPABASE_ANON_KEY));
  }

  return {
    plugins: [react()],
    base: '/',
    build: {
      outDir: 'build',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
  };
});
