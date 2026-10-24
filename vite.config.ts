import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { siteContent } from './plugins/site-content';

// Every .html page in the project root is built, so a new page just needs
// its file (see README: "Components").
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
