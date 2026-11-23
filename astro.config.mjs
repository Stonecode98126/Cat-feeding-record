import { defineConfig } from 'astro/config';

// 純靜態輸出。頁面內所有資源都用相對路徑，所以不需要設定 base，
// 同一份 dist/ 可直接放到 GitHub Pages（子路徑）與 Cloudflare Pages（根路徑）。
export default defineConfig({ output: 'static' });
