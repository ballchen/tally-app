-- Comprehensive RLS Policy Fixes

-- 1. GROUP MEMBERS
-- Allow users to leave group (delete their own membership)
create policy "Users can leave groups (delete own membership)"
  on group_members for delete
  using ( auth.uid() = user_id );

-- Allow users to update their own member profile (nickname, avatar in group)
create policy "Users can update own membership"
  on group_members for update
  using ( auth.uid() = user_id );

-- 2. GROUPS
-- Allow creators to update group details
create policy "Creators can update their groups"
  on groups for update
  using ( created_by = auth.uid() );

-- Allow creators to delete their groups
create policy "Creators can delete their groups"
  on groups for delete
  using ( created_by = auth.uid() );

-- 3. EXPENSES
-- Allow payer or creator to delete expenses
create policy "Payer or creator can delete expenses"
  on expenses for delete
  using ( 
    payer_id = auth.uid() 
    or 
    created_by = auth.uid() 
  );

-- Allow payer or creator to update expenses
create policy "Payer or creator can update expenses"
  on expenses for update
  using ( 
    payer_id = auth.uid() 
    or 
    created_by = auth.uid() 
  );

-- 4. EXPENSE SPLITS
-- Allow group members to delete splits (needed when updating expenses/splits)
-- Note: Usually cascades from expense delete, but needed for explicit removal during update
create policy "Group members can delete splits"
  on expense_splits for delete
  using (
    exists (
      select 1 from expenses
      join group_members on group_members.group_id = expenses.group_id
      where expenses.id = expense_splits.expense_id
      and group_members.user_id = auth.uid()
    )
  );
