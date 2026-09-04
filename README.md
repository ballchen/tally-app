# Tally App (monorepo)

Tally is a bill-splitting PWA. This repo is a pnpm workspaces + Turborepo
monorepo so that the web app (Next.js) and an upcoming Expo/React Native
mobile app can share balance-calculation logic, currency formatting, types,
and i18n messages.

## Structure

```
apps/web/         # Next.js web app — see apps/web/README.md and apps/web/DEPLOYMENT.md
packages/shared/   # @tally/shared — pure functions, types, i18n messages shared with mobile
supabase/          # Database migrations (path unchanged, shared by web and future functions)
```

## Getting started

Requires Node 22 and pnpm 10 (`packageManager` is pinned in `package.json`).

```bash
pnpm install       # install all workspace dependencies
pnpm dev           # start the web app dev server (apps/web)
pnpm build         # build all packages (turbo run build)
pnpm lint          # lint all packages
pnpm typecheck     # tsc --noEmit for every package
pnpm test          # run @tally/shared's vitest suite
```

## Deploying

The web app deploys to Vercel. Set the Vercel project's **Root Directory** to
`apps/web` — see `apps/web/DEPLOYMENT.md` for full details.
