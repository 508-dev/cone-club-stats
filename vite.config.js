import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [svelte()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        seatbelt: resolve(__dirname, 'seatbelt.html'),
      },
    },
  },
});
