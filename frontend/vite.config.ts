import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Vite configuration for High School Schedule Creator & Adjuster
// - react(): Provides Fast Refresh and JSX transformation
// - tailwindcss(): Vite plugin for Tailwind CSS v4 integration
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
});
