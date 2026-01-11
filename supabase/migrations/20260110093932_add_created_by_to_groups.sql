-- Add created_by column to groups
alter table groups add column created_by uuid references auth.users default auth.uid();

-- Update groups Insert policy to ensure created_by is set correctly (optional strictness, but good for data integrity)
-- Existing Insert policy just checks "authenticated". We can keep it or refine it.
-- But crucially, we must update the Select policy.

-- Update Select policy to allow creators to view their groups even if not yet a member
drop policy "Users can view groups they belong to" on groups;

create policy "Users can view groups they belong to"
  on groups for select
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = groups.id
      and group_members.user_id = auth.uid()
    )
    or
    created_by = auth.uid()
  );
