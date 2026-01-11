-- Function to get group details by invite code (bypassing RLS)
create or replace function get_group_by_invite_code(code text)
returns setof groups
language sql
security definer
as $$
  select * from groups where invite_code = code limit 1;
$$;

-- Allow public access to this function is default, but ensuring good practice if needed in future
comment on function get_group_by_invite_code is 'Allows public access to fetch group basic info via invite code';
