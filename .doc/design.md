# Project Design Document: Tally
**Version:** 1.0.0
**Type:** Mobile-First PWA (Bill Splitting Application)
**Target Stack:** Next.js 14 (App Router), TypeScript, Supabase

## 1. Project Overview
"Tally" is a Progressive Web App (PWA) designed for splitting bills among friends during travel or events. Key differentiators include a "Calculator-first" UI for rapid entry, support for multi-currency with historical exchange rates, and real-time synchronization.

## 2. Tech Stack & Libraries
* **Framework:** Next.js 14+ (App Router)
* **Language:** TypeScript (Strict mode)
* **Styling:** Tailwind CSS + `clsx` + `tailwind-merge`
* **Components:** Shadcn/ui (Radix UI based)
* **Icons:** Lucide React
* **Database & Auth:** Supabase (PostgreSQL)
* **State Management:** Zustand (for global UI state like the active group or calculator input)
* **Data Fetching:** TanStack Query (React Query)
* **PWA:** `@ducanh2912/next-pwa` or standard `next-pwa`
* **Realtime:** Supabase Realtime (Postgres Changes)

## 3. Database Schema (PostgreSQL)
*Constraint: Use `NUMERIC` types for financial data, never FLOAT.*

```sql
-- 1. Profiles (Public profile synced with Auth)
create table profiles (
  id uuid references auth.users not null primary key,
  display_name text,
  avatar_url text,
  default_currency text default 'TWD',
  updated_at timestamptz
);

-- 2. Groups
create table groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  base_currency text not null default 'TWD', -- The currency used for settlement
  invite_code text unique not null, -- Short alphanumeric code (e.g., Nanoid)
  created_at timestamptz default now()
);

-- 3. Group Members (Supports per-group identity)
create table group_members (
  group_id uuid references groups not null,
  user_id uuid references profiles not null,
  group_nickname text,   -- If NULL, fallback to profiles.display_name
  group_avatar_url text, -- If NULL, fallback to profiles.avatar_url
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- 4. Expenses
create table expenses (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups not null,
  payer_id uuid references profiles not null,
  description text,
  amount numeric(12, 4) not null, -- Original amount entered
  currency text not null,         -- Original currency (e.g., JPY)
  exchange_rate numeric(10, 6) not null default 1.0, -- Rate relative to group.base_currency at transaction time
  date timestamptz default now(),
  created_by uuid references auth.users
);

-- 5. Expense Splits (Persisted split logic)
create table expense_splits (
  id uuid default gen_random_uuid() primary key,
  expense_id uuid references expenses on delete cascade not null,
  user_id uuid references profiles not null, -- The debtor
  owed_amount numeric(12, 4) not null        -- Calculated share in Original Currency
);
```

## 4. PWA Push Notifications
**Goal:** Notify users when:
1. They are added to a group.
2. A new expense is added to a group they are in.
3. Settlement is requested/completed.

### 4.1. Architecture
- **VAPID Keys:** Standard Web Push protocol.
- **Service Worker:** Extend default `next-pwa` SW with a custom script (`public/push-sw.js`) containing the `push` event listener.
- **Database:** Wrapper table for subscriptions.
- **Trigger:** Next.js API Routes / Server Actions triggered by application logic.

### 4.2. Database Schema
```sql
-- 6. Push Subscriptions
create table push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles not null,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- Index for fast lookup by user
create index idx_push_user on push_subscriptions(user_id);
```

### 4.3. API Routes
- `POST /api/push/subscribe`: UPSERT subscription for the current user.
- `POST /api/push/send` (Internal/Protected): Send notification to specific `userIds`.

### 4.4. Frontend Flow
1. User clicks "Enable Notifications" (Profile or Group page).
2. App requests permission (`Notification.requestPermission`).
3. If granted, App registers subscription (`sw.pushManager.subscribe`).
4. App sends subscription JSON to `/api/push/subscribe`.

### 4.5. Service Worker (`push-sw.js`)
Handles:
- `push` event: Show notification.
- `notificationclick` event: Focus window or open specific URL (e.g., `/groups/[id]`).