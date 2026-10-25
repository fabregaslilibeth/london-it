import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { siteContent } from './plugins/site-content';

// Every hand-written .html page in the project root is built (the synced
// inner pages are added by plugins/site-content.ts; see README: "Pages").
const root = fileURLToPath(new URL('.', import.meta.url));
const pages = Object.fromEntries(
  readdirSync(root)
    .filter((file) => file.endsWith('.html'))
    .map((file) => [file.replace(/\.html$/, ''), resolve(root, file)]),
);

export default defineConfig({
  plugins: [siteContent()],
  build: {
    rollupOptions: { input: pages },
    // three.js alone is ~500 kB minified; one chunk is fine for a one-page site.
    chunkSizeWarningLimit: 800,
  },
});
