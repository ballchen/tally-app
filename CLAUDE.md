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
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/                # API routes (currency rates, push notifications)
│   ├── auth/callback/      # Supabase auth callback
│   ├── groups/[groupId]/   # Group details page (main UI)
│   ├── join/[inviteCode]/  # Join group via invite link
│   ├── login/              # Login page
│   ├── reset-password/     # Password reset flow
│   └── forgot-password/    # Forgot password page
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── expenses/           # Expense-related components
│   ├── settlement/         # Settlement dialog components
│   ├── groups/             # Group management components
│   └── providers/          # React context providers
├── hooks/                  # React Query hooks (data fetching)
├── lib/
│   ├── supabase/           # Supabase client (browser/server)
│   └── currency.ts         # Currency conversion utilities
├── i18n/                   # next-intl configuration
└── types/                  # TypeScript type definitions

messages/                   # i18n translation files (en.json, zh-TW.json, ja.json)
supabase/migrations/        # Database migrations (SQL)
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
- `useGroupDetails`: Fetches group with members, expenses, settlements
- `useBalances`: Calculates net balances and simplified debts
- `useSettleUp`: Calls `settle_group_expenses` RPC
- `useGranularSettle`: Calls `settle_debt_rpc` for one-to-one
- `useUndoSettlement`: Calls `undo_settlement` RPC
- `useRealtimeSync`: Supabase realtime subscriptions

## Common Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check

# Supabase
supabase db push     # Push migrations to remote
supabase db reset    # Reset local database
```

## i18n Keys Location
Translation keys are organized by feature in `messages/*.json`:
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
1. **RLS on groups table is disabled** due to auth.uid() issues with anonymous key
2. **Exchange rates** are cached in `exchange_rates` table, fetched from external API
3. **Realtime** is enabled for group_members, expenses, expense_splits
4. **Group archive/hide** are separate concepts (archive = read-only for all, hide = personal)

## Git Conventions
- Commit messages follow conventional commits (feat:, fix:, chore:)
- Include `Co-Authored-By: Claude` when AI-assisted
