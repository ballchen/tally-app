-- Enable RLS
alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;

-- Function to handle new user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Policies: Profiles
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

create policy "Users can insert their own profile"
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- Policies: Groups
-- For now, allow authenticated users to create groups
create policy "Authenticated users can create groups"
  on groups for insert
  with check ( auth.role() = 'authenticated' );

-- Users can view groups they are members of
create policy "Users can view groups they belong to"
  on groups for select
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = groups.id
      and group_members.user_id = auth.uid()
    )
  );

-- Policies: Group Members
create policy "Users can view members of their groups"
  on group_members for select
  using (
    exists (
      select 1 from group_members as gm
      where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
    )
  );

create policy "Users can join groups (insert themselves)"
  on group_members for insert
  with check ( auth.uid() = user_id );

-- Policies: Expenses
create policy "Group members can view expenses"
  on expenses for select
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = expenses.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "Group members can insert expenses"
  on expenses for insert
  with check (
    exists (
      select 1 from group_members
      where group_members.group_id = expenses.group_id
      and group_members.user_id = auth.uid()
    )
  );

-- Policies: Expense Splits
create policy "Group members can view splits"
  on expense_splits for select
  using (
    exists (
      select 1 from expenses
      join group_members on group_members.group_id = expenses.group_id
      where expenses.id = expense_splits.expense_id
      and group_members.user_id = auth.uid()
    )
  );
