-- Tally Complete Schema - 2026-01-12
-- Single consolidated migration with all tables, RLS policies, and RPCs
-- Includes: Profiles, Groups, Members, Settlements, Expenses, Splits, Push, Exchange Rates

-- ====================
-- 1. HELPER FUNCTIONS
-- ====================

create or replace function is_group_member(_group_id uuid)
returns boolean language plpgsql security definer stable as $$
begin
  return exists (
    select 1 from group_members
    where group_id = _group_id
    and user_id = auth.uid()
  );
end;
$$;

create or replace function is_expense_participant(_expense_id uuid)
returns boolean language plpgsql security definer stable as $$
begin
  return exists (
    select 1 from expense_splits
    where expense_id = _expense_id
    and user_id = auth.uid()
  );
end;
$$;

-- ====================
-- 2. TABLES
-- ====================

-- Profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  display_name text,
  avatar_url text,
  default_currency text default 'TWD',
  gender text check (gender in ('male', 'female', 'other')),
  updated_at timestamptz
);

alter table profiles enable row level security;
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Trigger to create profile on auth signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Groups
create table groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  base_currency text not null default 'TWD',
  invite_code text unique not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- TEMPORARY: RLS disabled on groups due to auth.uid() issue with anonymous key
-- TODO: Re-enable once Supabase client properly sends authenticated requests
-- alter table groups enable row level security;
-- create policy "Groups viewable by members" on groups for select using (is_group_member(id));
-- create policy "Users can create groups" on groups for insert with check (auth.uid() is not null);
-- create policy "Creators can update groups" on groups for update using (created_by = auth.uid());
-- create policy "Creators can delete groups" on groups for delete using (created_by = auth.uid());

-- Group Members
create table group_members (
  group_id uuid references groups on delete cascade not null,
  user_id uuid references profiles on delete cascade not null,
  group_nickname text,
  group_avatar_url text,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

alter table group_members enable row level security;
create policy "View members" on group_members for select using (
  auth.uid() = user_id or is_group_member(group_id)
);
create policy "Join group" on group_members for insert with check (auth.uid() = user_id);
create policy "Update self membership" on group_members for update using (auth.uid() = user_id);
create policy "Leave group" on group_members for delete using (auth.uid() = user_id);

-- Settlements
create table settlements (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups on delete cascade not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table settlements enable row level security;
create policy "View settlements" on settlements for select using (is_group_member(group_id));
create policy "Users can create settlements" on settlements for insert with check (
  is_group_member(group_id) and auth.uid() = created_by
);
create policy "Delete settlements" on settlements for delete using (is_group_member(group_id));

-- Expenses
create table expenses (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups on delete cascade not null,
  payer_id uuid references profiles(id) not null,
  description text,
  amount numeric(12, 4) not null,
  currency text not null,
  exchange_rate numeric(10, 6) default 1.0,
  date timestamptz default now(),
  created_by uuid references profiles(id),
  type text check (type in ('expense', 'repayment', 'income')) default 'expense',
  settlement_id uuid references settlements(id) on delete cascade
);

alter table expenses enable row level security;
create policy "View expenses" on expenses for select using (is_group_member(group_id));
create policy "Users can create expenses" on expenses for insert with check (
  is_group_member(group_id) and (created_by is null or auth.uid() = created_by)
);
create policy "Update expenses" on expenses for update using (payer_id = auth.uid() or created_by = auth.uid());
create policy "Delete expenses" on expenses for delete using (payer_id = auth.uid() or created_by = auth.uid());

-- Expense Splits
create table expense_splits (
  id uuid default gen_random_uuid() primary key,
  expense_id uuid references expenses on delete cascade not null,
  user_id uuid references profiles(id) not null,
  owed_amount numeric(12, 4) not null,
  settlement_id uuid references settlements(id) on delete set null
);

alter table expense_splits enable row level security;
create policy "View splits" on expense_splits for select using (
  exists (select 1 from expenses e where e.id = expense_id and is_group_member(e.group_id))
);
create policy "Insert splits" on expense_splits for insert with check (
  exists (select 1 from expenses e where e.id = expense_id and is_group_member(e.group_id))
);
create policy "Delete splits" on expense_splits for delete using (
  exists (select 1 from expenses e where e.id = expense_id and (e.payer_id = auth.uid() or e.created_by = auth.uid()))
);

-- Push Subscriptions
create table push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table push_subscriptions enable row level security;
create policy "Manage own subscriptions" on push_subscriptions for all using (auth.uid() = user_id);

-- Exchange Rates
create table exchange_rates (
  id uuid default gen_random_uuid() primary key,
  date date unique not null,
  rates jsonb not null,
  created_at timestamptz default now()
);

alter table exchange_rates enable row level security;
create policy "Authenticated users can read exchange rates"
  on exchange_rates for select
  to authenticated
  using (true);

-- ====================
-- 3. RPCs
-- ====================

-- Update Expense (Transactional)
create or replace function update_expense_details(
  p_expense_id uuid,
  p_payer_id uuid,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_splits jsonb
)
returns void language plpgsql security definer as $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id from expenses where id = p_expense_id;
  if not is_group_member(v_group_id) then raise exception 'Not a member'; end if;

  update expenses
  set payer_id = p_payer_id, amount = p_amount, currency = p_currency, description = p_description
  where id = p_expense_id;

  delete from expense_splits where expense_id = p_expense_id;

  insert into expense_splits (expense_id, user_id, owed_amount)
  select p_expense_id, (x->>'user_id')::uuid, (x->>'amount')::numeric
  from jsonb_array_elements(p_splits) as x;
end;
$$;

-- Settle Debt (Granular)
create or replace function settle_debt_rpc(
  p_group_id uuid,
  p_debtor_id uuid,
  p_creditor_id uuid,
  p_amount numeric,
  p_currency text
)
returns uuid language plpgsql security definer as $$
declare
  v_settlement_id uuid;
  v_expense_id uuid;
begin
  if not is_group_member(p_group_id) then raise exception 'Not a member'; end if;

  insert into settlements (group_id, created_by)
  values (p_group_id, auth.uid())
  returning id into v_settlement_id;

  update expense_splits s
  set settlement_id = v_settlement_id
  from expenses e
  where s.expense_id = e.id
  and e.group_id = p_group_id
  and s.user_id = p_debtor_id
  and e.payer_id = p_creditor_id
  and s.settlement_id is null;

  insert into expenses (
    group_id, payer_id, amount, currency, description, type, settlement_id, created_by
  ) values (
    p_group_id, p_debtor_id, p_amount, p_currency, 'Settlement', 'repayment', v_settlement_id, auth.uid()
  ) returning id into v_expense_id;
  
  insert into expense_splits (expense_id, user_id, owed_amount, settlement_id)
  values (v_expense_id, p_creditor_id, p_amount, v_settlement_id);

  return v_settlement_id;
end;
$$;

-- Undo Settlement
create or replace function undo_settlement(p_settlement_id uuid)
returns void language plpgsql security definer as $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id from settlements where id = p_settlement_id;
  if not is_group_member(v_group_id) then raise exception 'Not a member'; end if;
  
  delete from settlements where id = p_settlement_id;
end;
$$;

-- Get Group by Invite Code
create or replace function get_group_by_invite_code(code text)
returns json language plpgsql security definer as $$
declare
  result json;
begin
  select json_build_object('id', id, 'name', name) into result
  from groups where invite_code = code limit 1;
  return result;
end;
$$;

-- Create Group (bypasses RLS with security definer)
create or replace function create_group(
  p_name text,
  p_base_currency text,
  p_invite_code text
)
returns uuid language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_group_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  
  insert into groups (name, base_currency, invite_code, created_by)
  values (p_name, p_base_currency, p_invite_code, v_user_id)
  returning id into v_group_id;
  
  insert into group_members (group_id, user_id)
  values (v_group_id, v_user_id);
  
  return v_group_id;
end;
$$;

-- ====================
-- 4. REALTIME
-- ====================

-- Enable Supabase Realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE expense_splits;

