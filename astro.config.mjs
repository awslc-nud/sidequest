// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // The standalone Node adapter sees the tunnel's internal HTTP request. The
  // app middleware performs its own CSRF check (Sec-Fetch-Site, falling back to
  // Origin vs. the configured ORIGIN), so Astro's default check — which compares
  // against that internal URL — must be delegated to it.
  security: {
    checkOrigin: false,
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
