-- Fix restrictive RLS on expenses
-- Problem: Previous policy only allowed payer or creator to update/delete.
-- This blocked editing if you weren't the payer (and created_by was NULL), 
-- and caused violations if you changed the payer to someone else.

-- Solution: Allow any valid group member to update/delete expenses within the group.

-- 1. DROP existing policies
drop policy "Payer or creator can update expenses" on expenses;
drop policy "Payer or creator can delete expenses" on expenses;

-- 2. CREATE new broader policies

-- Update: Allow any group member to update expenses
create policy "Group members can update expenses"
  on expenses for update
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = expenses.group_id
      and group_members.user_id = auth.uid()
    )
  );

-- Delete: Allow any group member to delete expenses
create policy "Group members can delete expenses"
  on expenses for delete
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = expenses.group_id
      and group_members.user_id = auth.uid()
    )
  );
