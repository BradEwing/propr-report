// @ts-check
import { defineConfig } from 'astro/config';

// Project Pages: the site is served from https://bradewing.github.io/propr-report/
// Every asset and data URL must be base-relative (see src/lib/dataUrl.ts), or it
// 404s on GitHub Pages.
export default defineConfig({
  site: 'https://bradewing.github.io',
  base: '/propr-report',
  output: 'static',
});
