-- Drop potentially problematic policy
drop policy if exists "Group members can view splits" on expense_splits;

-- Re-create policy using the secure function to check group membership via expenses
create policy "Group members can view splits"
  on expense_splits for select
  using (
    exists (
      select 1 from expenses
      where expenses.id = expense_splits.expense_id
      and expenses.group_id in (select get_auth_user_groups())
    )
  );
