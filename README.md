# 花花 Pet Care（Astro）

花花的餵食紀錄頁。前端是 Astro 靜態網站，後端是 Google Apps Script + Google Sheets。
同一份程式可以同時發佈到 GitHub Pages 與 Cloudflare Pages，不需要改任何設定。

## 本機開發

需要 Node.js 22.23.4 以上（版本寫在 `.nvmrc`）。

```bash
npm install
npm run dev      # http://localhost:4321/
npm run build    # 輸出到 dist/
npm run preview  # 預覽 dist/
```

## 發佈到 GitHub Pages

1. 把專案推到 GitHub 的 `main` 分支。
2. 到 repo 的 Settings → Pages，Source 選 **GitHub Actions**。
3. 之後每次推送到 `main`，`.github/workflows/deploy.yml` 會自動建置並發佈。
   網址是 `https://<帳號>.github.io/<repo 名稱>/`。

## 發佈到 Cloudflare Pages

在 Cloudflare 建立 Pages 專案並連結同一個 GitHub repo：

- Framework preset：Astro
- Build command：`npm run build`
- Build output directory：`dist`

Node 版本會讀 `.nvmrc`。如果建置時出現 Node 版本過舊的錯誤，
在專案的環境變數加上 `NODE_VERSION` = `22.23.5`。

## 後端（Apps Script）

`backend/Code.gs` 是目前線上使用的版本，內容沒有變動，不需要重新部署。
前端呼叫的網址在 `src/pages/index.astro` 的 `SCRIPT_URL`；只有重新建立部署、網址改變時才需要改。

今日統計用的是 Apps Script 專案的時區，請在 Apps Script 的「專案設定」確認為 `Asia/Taipei`。

## 花花的照片

把照片放到 `public/v3.jpeg`。沒有照片時頁面仍可使用，只是照片的位置會是空的。

## 檔案說明

- `src/pages/index.astro`：首頁（表單、與 Apps Script 的讀寫、Three.js 場景）。
- `public/service-worker.js`：同源資源的離線快取。
- `public/.nojekyll`：讓 GitHub Pages 不經 Jekyll 處理。
- `.github/workflows/deploy.yml`：GitHub Pages 自動部署。
- `backend/Code.gs`：Apps Script 後端。

## 為什麼兩邊都能用

GitHub Pages 的網址有子路徑（`/<repo 名稱>/`），Cloudflare Pages 沒有。
首頁的 `<script>` 與 `<style>` 都加了 `is:inline`，Astro 會原樣輸出而不打包成 `/_astro/` 下的檔案，
圖片與 service worker 也用相對路徑，所以不需要設定 `base`。
之後如果把樣式或腳本拆成 Astro 元件並讓 Astro 打包，就要在 `astro.config.mjs` 依部署位置設定 `base`。
