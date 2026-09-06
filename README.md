# Tally App (monorepo)

Tally is a bill-splitting PWA. This repo is a pnpm workspaces + Turborepo
monorepo so that the web app (Next.js) and an upcoming Expo/React Native
mobile app can share balance-calculation logic, currency formatting, types,
and i18n messages.

## Structure

```
apps/web/          # Next.js web app — see apps/web/README.md and apps/web/DEPLOYMENT.md
apps/mobile/       # Expo (SDK 57) iOS app — expo-router, shares the data layer with web
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

### Running the iOS app

Requires Xcode and an iOS Simulator.

```bash
cp apps/mobile/.env.example apps/mobile/.env   # fill in the Supabase URL + anon key
pnpm --filter @tally/mobile ios                # prebuild, compile and launch on a Simulator
pnpm --filter @tally/mobile start              # Metro only, once the app is installed
```

`apps/mobile/ios` is Continuous Native Generation output — `expo prebuild`
recreates it, so it is not committed. UI checks live in `apps/mobile/.maestro`
and run against a booted Simulator — see `apps/mobile/.maestro/README.md` for
how to invoke Maestro and how to seed the fixtures the flows expect. The flows
tagged `docs` only take screenshots, so a whole-directory sweep skips them:
`maestro test --exclude-tags=docs apps/mobile/.maestro/`.

### Building the iOS app with EAS

Profiles live in `apps/mobile/eas.json`; run the commands from `apps/mobile`.

```bash
npx eas-cli build --platform ios --profile preview-simulator   # .app for a Simulator, no signing
npx eas-cli build --platform ios --profile preview             # internal distribution (needs Apple credentials)
npx eas-cli build --platform ios --profile production          # App Store build
npx eas-cli submit --platform ios --profile production         # upload to TestFlight
```

EAS never uploads `.env`, so `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` are stored as EAS project variables
(`npx eas-cli env:list`); without them a build launches to a blank screen.

A Simulator build downloads as a `.tar.gz`; unpack it and
`xcrun simctl install booted Tally.app`. `cli.appVersionSource` is `remote`,
so EAS owns the build number once a build has run.

Before submitting, work through `apps/mobile/docs/release-checklist.md` — it
records what is already configured and what still needs an Apple Developer
account. `apps/mobile/docs/screens/` holds the light/dark and
largest-Dynamic-Type reference captures.

## Deploying

The web app deploys to Vercel. Set the Vercel project's **Root Directory** to
`apps/web` — see `apps/web/DEPLOYMENT.md` for full details.
