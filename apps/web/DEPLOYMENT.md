# 🚀 Tally App - Vercel 部署指南

## 📦 Monorepo 設定（重要）

本專案已改為 pnpm workspaces + Turborepo monorepo，web app 搬到了 `apps/web`。
在 Vercel Project Settings > General 中，需要把 **Root Directory** 從 repo 根改成 `apps/web`，
Build Command 維持自動偵測（Vercel 會執行 `pnpm turbo run build --filter=@tally/web...` 或
`next build`，安裝指令請確保使用 `pnpm install`，因為 lockfile 是 `pnpm-lock.yaml`）。

## 📋 前置準備

在部署之前，請確保您已經：

1. ✅ Supabase 專案已設置完成 (Project ID: `pxjzidgstaxdxgouimyn`)
2. ✅ 資料庫 schema 已初始化完成
3. ✅ GitHub repository 已建立

## 🔧 環境變數設定

在 Vercel 部署時，需要設定以下環境變數：

### 必要變數

```bash
NEXT_PUBLIC_SUPABASE_URL=https://pxjzidgstaxdxgouimyn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 可選變數（Web Push 通知）

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

## 📦 部署步驟

### 方法一：使用 Vercel CLI

1. 安裝 Vercel CLI：
```bash
npm i -g vercel
```

2. 登入 Vercel：
```bash
vercel login
```

3. 部署：
```bash
vercel
```

4. 設定環境變數：
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 方法二：使用 Vercel Dashboard

1. 前往 [Vercel Dashboard](https://vercel.com/new)

2. 點擊 "Import Project"

3. 選擇您的 GitHub repository

4. 設定環境變數：
   - 在 "Environment Variables" 區塊中添加上述變數

5. 點擊 "Deploy"

## 🔑 取得 Supabase Anon Key

1. 前往 [Supabase Dashboard](https://supabase.com/dashboard/project/pxjzidgstaxdxgouimyn/settings/api)
2. 在 "Project API keys" 區塊中
3. 複製 `anon` `public` key

## 🌐 Supabase 配置

### 設定 Site URL

在 Supabase Dashboard 中設定：

1. 前往 Authentication > URL Configuration
2. 設定 Site URL 為您的 Vercel domain，例如：
   ```
   https://your-app.vercel.app
   ```
3. 添加 Redirect URLs：
   ```
   https://your-app.vercel.app/**
   ```

## ✅ 驗證部署

部署完成後，請測試以下功能：

- [ ] 註冊/登入功能
- [ ] 創建群組
- [ ] 新增消費記錄
- [ ] 結算功能
- [ ] Realtime 同步

## 🐛 常見問題

### Build 失敗

如果遇到 `useSearchParams()` 相關錯誤，已經修復：
- ✅ Login page 已使用 Suspense boundary 包裹

### 連線問題

確保環境變數設定正確：
- `NEXT_PUBLIC_SUPABASE_URL` 格式正確
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 已正確複製

### RLS 權限問題

某些表的 RLS 已暫時停用（如 `groups`），如需啟用請參考 migration 檔案中的註解。

## 📚 更多資源

- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Supabase with Vercel](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
