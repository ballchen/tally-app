# Tally App - Project Context for Claude

## Overview
Tally is a bill-splitting PWA for sharing expenses with friends. Users create groups, add expenses, and the app calculates who owes whom using a simplified debt algorithm.

## Tech Stack
- **Framework**: Next.js 16 with App Router
- **Database**: Supabase (PostgreSQL + Auth + Realtime + Storage)
- **State**: TanStack Query (React Query) + Zustand
- **Styling**: Tailwind CSS v4 + shadcn/ui (Radix primitives)
- **i18n**: next-intl (en, zh-TW, ja)
- **PWA**: @ducanh2912/next-pwa with web-push notifications

## Project Structure
This is a pnpm workspaces + Turborepo monorepo. The web app lives in `apps/web`,
the Expo/React Native iOS app in `apps/mobile`; pure logic, types, and i18n
messages shared by both live in `packages/shared`.
```
apps/web/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── auth/callback/      # Supabase auth callback
│   │   ├── groups/[groupId]/   # Group details page (main UI)
│   │   ├── join/[inviteCode]/  # Join group via invite link
│   │   ├── login/              # Login page
│   │   ├── reset-password/     # Password reset flow
│   │   └── forgot-password/    # Forgot password page
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── expenses/           # Expense-related components
│   │   ├── settlement/         # Settlement dialog components
│   │   ├── groups/             # Group management components
│   │   └── providers/          # React context providers
│   ├── hooks/                  # Thin wrappers over @tally/shared/queries (toast + i18n + push)
│   ├── lib/
│   │   └── supabase/           # Supabase client (browser/server)
│   └── i18n/                   # next-intl configuration (reads messages from @tally/shared)
└── public/

apps/mobile/                   # Expo SDK 57 + expo-router (iOS); native ios/ dir is CNG output, not committed
├── app/                       # expo-router routes: (auth), (app), (dev), join/[code], reset-password, auth/callback
├── components/                # AuthGate, Screen, AppleSignInButton, ui/ (Button, Input, Text, Surface, Avatar, Skeleton, Toast)
├── theme/                     # tokens.ts (light/dark palettes) + useTheme()
├── lib/                       # supabase client (SecureStore-encrypted session), i18n (i18n-js), auth-link
├── stores/                    # zustand auth store (session + pending deep-link route)
└── .maestro/                  # Maestro UI flows, one set per phase

packages/shared/
├── src/
│   ├── balances.ts, currency.ts, members.ts  # Pure functions shared with mobile
│   ├── supabase-context.tsx                  # SupabaseProvider / useSupabase (client injection)
│   ├── lib/                                  # auth-helpers, activity-log, push, split-form, ...
│   ├── queries/                               # UI-free TanStack Query hooks shared with mobile
│   ├── types/supabase.ts                     # Generated Supabase types
│   └── i18n/messages/{en,zh-TW,ja}.json      # i18n translation files
└── package.json                              # "@tally/shared" — exports raw TS, no build step

supabase/migrations/        # Database migrations (SQL) — stays at repo root, unchanged
supabase/functions/         # Deno Edge Functions (rates, push-send, delete-account)
```

## Database Schema (Supabase)

### Core Tables
- **profiles**: User profiles (id, display_name, avatar_url, default_currency)
- **groups**: Bill-splitting groups (name, base_currency, invite_code, created_by)
- **group_members**: Group membership (group_id, user_id, hidden_at, joined_at)
- **expenses**: All expenses including repayments (amount, currency, payer_id, type, settlement_id)
- **expense_splits**: Who owes what per expense (expense_id, user_id, owed_amount)
- **settlements**: Settlement records (group_id, created_by, created_at)

### Expense Types
- `expense`: Regular expense (someone paid, others owe)
- `repayment`: Settlement payment (debtor pays creditor)
- `income`: Shared income (negative expense)

## Settlement Logic (CRITICAL)

### How It Works
1. **Balance Calculation**: All expenses (including repayments) participate in balance calculation
2. **Simplified Debts**: Uses greedy algorithm to minimize number of transactions
3. **Repayments Offset Debts**: When A settles with B, a repayment expense is created where A is payer, B is in splits
4. **Undo via CASCADE**: Deleting settlement cascades to delete associated repayment expenses

### Key RPCs (PostgreSQL Functions)
- `settle_debt_rpc(group_id, debtor_id, creditor_id, amount, currency)`: One-to-one settlement
- `settle_group_expenses(group_id, repayments_jsonb)`: Settle all debts at once
- `undo_settlement(settlement_id)`: Delete settlement (cascades to repayments)
- `update_expense_details(...)`: Transactional expense update
- `create_group(name, currency, invite_code)`: Create group + add creator as member

### Balance Calculation (`use-balances.ts`)
```typescript
// For each expense:
// 1. Payer gains credit (+) equal to sum of splits
// 2. Each split user owes that amount (-)
// Repayments naturally offset: payer gains, split user loses

// Then simplify using greedy algorithm:
// Match debtors with creditors to minimize transactions
```

## Important Hooks
All data-layer hooks live in `packages/shared/src/queries/` and are UI-free: they
take their Supabase client from `useSupabase()` and never toast, translate, or
call `fetch("/api/...")`. `apps/web/src/hooks/*.ts` are thin wrappers that add
next-intl strings, sonner toasts and push notifications.
- `queries/group-details.ts` — `useGroupDetails`, `fetchGroupDetails`
- `queries/groups.ts` — `useGroups`, `useMyGroupBalances`, create/update/archive/delete/hide, `useLeaveGroup`, `useRemoveMember`
- `queries/balances.ts` — `useBalances` (net balances + simplified debts)
- `queries/expenses.ts` — `useExpense`, `useAddExpense` (optimistic), update/delete/restore
- `queries/settlements.ts` — `useSettleUp`, `useGranularSettle`, `useUndoSettlement`
- `queries/exchange-rates.ts` — `useExchangeRates` (invokes the `rates` Edge Function)
- `queries/profile.ts`, `queries/activity-logs.ts`
- `queries/realtime.ts` — `useRealtimeSync` / `useRealtimeGroups`, reporting changes through an `onEvent` callback

## Edge Functions (`supabase/functions/`)
The web app has no API routes; server-side work runs as Supabase Edge Functions,
called with `supabase.functions.invoke(...)` so the mobile app can share them.
- `rates`: cached daily exchange rates (auth required)
- `push-send`: web-push + Expo push fan-out; group membership is enforced server-side
- `delete-account`: App Store required in-app account deletion

Deploy: `npx supabase functions deploy <name> --project-ref <ref>`.
Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

## Common Commands
Run from the repo root (pnpm workspaces + Turborepo). Node 22 is required (Next.js 16).
```bash
pnpm install              # Install all workspace deps
pnpm dev                  # Start web dev server (apps/web)
pnpm build                # Production build (turbo run build)
pnpm lint                 # ESLint (turbo run lint)
pnpm typecheck            # tsc --noEmit for every package (turbo run typecheck)
pnpm test                 # Vitest unit tests (turbo run test)

# Mobile (apps/mobile) — requires Xcode; the ios/ dir is regenerated, never committed
pnpm --filter @tally/mobile ios        # expo prebuild output + build + install on a Simulator
pnpm --filter @tally/mobile start      # Metro bundler only
pnpm --filter @tally/mobile test       # theme token tests
maestro test apps/mobile/.maestro/     # UI flows against a booted Simulator
                                       # (Maestro is machine-local, not a repo dep;
                                       #  see apps/mobile/.maestro/README.md)

# Supabase
supabase db push     # Push migrations to remote
supabase db reset    # Reset local database
```

## i18n Keys Location
Translation keys live in `packages/shared/src/i18n/messages/*.json` and are organized by feature:
- `Auth`: Login/signup related
- `Groups`: Group list page
- `GroupDetails`: Main group page (expenses, settlements, balances)
- `CreateGroup`: Group creation
- `EditGroup`: Group settings
- `SettleUp`: Settlement dialog
- `AddExpense`: Expense creation/editing

## UI Patterns

### Activity Timeline (Group Details)
- Expenses and settlements are shown in a single chronological timeline
- Settlement cards are expandable to show individual repayment details
- No tab switching between "current" and "history"

### Settlement Card
- Shows settler name, date, and total amount when collapsed
- Expands to show individual repayments (who → who, amount)
- Delete button triggers undo confirmation dialog

## Known Considerations
1. **RLS is enabled on all tables** (groups since migration 20260203000005). `group_members` SELECT only exposes your own row, so member lists must go through `get_group_members_batch`. Server routes that need cross-user rows use `createAdminClient()` (service role)
2. **Exchange rates** are cached in `exchange_rates` table, fetched from external API
3. **Realtime** is enabled for group_members, expenses, expense_splits, settlements (REPLICA IDENTITY FULL so DELETE payloads carry group_id)
4. **Group archive/hide** are separate concepts (archive = read-only for all, hide = personal)

## Git Conventions
- Commit messages follow conventional commits (feat:, fix:, chore:)
- Include `Co-Authored-By: Claude` when AI-assisted
