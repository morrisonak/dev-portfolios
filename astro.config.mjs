// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://dev-portfolios.jmorrison.workers.dev',
  output: 'static',

  vite: {
    plugins: [tailwindcss()],
  },
});