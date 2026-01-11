-- Allow group members to insert expense splits
create policy "Group members can insert splits"
  on expense_splits for insert
  with check (
    exists (
      select 1 from expenses
      join group_members on group_members.group_id = expenses.group_id
      where expenses.id = expense_splits.expense_id
      and group_members.user_id = auth.uid()
    )
  );
