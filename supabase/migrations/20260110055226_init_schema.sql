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
