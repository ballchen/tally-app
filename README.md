# Tally - Bill Splitting App 💰

A modern, mobile-first PWA for splitting bills with friends. Built with Next.js 15, Supabase, and TypeScript.

## ✨ Features

- **Group Management**: Create groups, invite friends with shareable links
- **Expense Tracking**: Add expenses with multiple currencies
- **Smart Splitting**: Equal, exact amount, or percentage-based splits
- **Granular Settlement**: Settle individual debts, not just full groups
- **Undo Settlements**: Revert settlements if mistakes happen
- **Multi-Currency**: Live exchange rates updated daily
- **Push Notifications**: Get notified when expenses are added (PWA)
- **Offline Support**: Works offline with service worker caching

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm/yarn/pnpm
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Tally
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in the required values:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for API routes)
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: VAPID public key for push notifications
   - `VAPID_PRIVATE_KEY`: VAPID private key (server-side only)

4. **Setup Supabase**
   
   Start Supabase locally:
   ```bash
   npx supabase start
   ```
   
   Apply migrations:
   ```bash
   npx supabase db reset
   ```
   
   Or link to existing project:
   ```bash
   npx supabase link --project-ref <your-project-id>
   npx supabase db push
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000)

## 📱 PWA Setup

### Generate VAPID Keys

For push notifications to work:

```bash
npx web-push generate-vapid-keys
```

Add the keys to `.env.local`.

### Install as PWA

1. Open the app in Chrome/Edge
2. Click "Install" when prompted
3. Or: Menu → Install Tally

## 🗄️ Database Schema

The app uses a consolidated migration system. Key tables:

- `profiles`: User profiles (auto-created on signup)
- `groups`: Expense groups
- `group_members`: Group memberships
- `expenses`: Individual expenses (with multi-currency support)
- `expense_splits`: Who owes what per expense
- `settlements`: Settlement batches (for undo functionality)
- `exchange_rates`: Cached daily exchange rates
- `push_subscriptions`: Push notification subscriptions

## 🌐 Deployment

### Deploy to Vercel (Recommended)

1. **Push code to GitHub**

2. **Import to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your repository
   - Vercel will auto-detect Next.js

3. **Add Environment Variables**
   
   In Vercel project settings, add all `.env.local` variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`

4. **Deploy**
   ```bash
   git push origin main
   ```
   
   Vercel will auto-deploy on push.

### Production Supabase Setup

1. Create a production project on [supabase.com](https://supabase.com)
2. Run migrations:
   ```bash
   npx supabase link --project-ref <prod-project-id>
   npx supabase db push
   ```
3. Update `.env.local` with production URLs

## 🧪 Testing

_(Coming soon)_

Basic test setup:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

## 📦 Project Structure

```
Tally/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities (Supabase client, currency helper)
│   └── store/            # Zustand stores
├── supabase/
│   └── migrations/       # Database migrations
├── public/               # Static assets (icons, manifest)
└── .env.local            # Environment variables (gitignored)
```

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript
- **UI**: Tailwind CSS, shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **State Management**: Zustand, TanStack Query
- **Authentication**: Supabase Auth
- **PWA**: Service Workers, Push API
- **Deployment**: Vercel

## 🔐 Security

- Row Level Security (RLS) enabled on all tables
- `security definer` functions to prevent RLS recursion
- Service Role key used only in API routes (server-side)
- Input validation on both frontend and database level

## 🤝 Contributing

_(Coming soon)_

## 📄 License

MIT

## 🐛 Known Issues

None at the moment! Report issues on GitHub.

## 💡 Roadmap

- [ ] E2E testing with Playwright
- [ ] Expense categories/tags
- [ ] Export to CSV/PDF
- [ ] Charts and analytics
- [ ] Receipt photo uploads
- [ ] Multi-language support

---

Made with ❤️ by Ball Chen
