-- RPC function to update expense and splits transactionally
-- This bypasses conflicting RLS on the table directly and ensures atomicity.

create or replace function update_expense_details(
  p_expense_id uuid,
  p_payer_id uuid,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_splits jsonb -- Array of {user_id, amount} objects
)
returns void
language plpgsql
security definer -- Run as owner to bypass RLS restrictions within the function
as $$
declare
  v_group_id uuid;
  v_is_member boolean;
begin
  -- 1. Get Group ID of the expense
  select group_id into v_group_id
  from expenses
  where id = p_expense_id;

  if v_group_id is null then
    raise exception 'Expense not found';
  end if;

  -- 2. Verify Auth User is a Member of that Group
  select exists (
    select 1 from group_members
    where group_id = v_group_id
    and user_id = auth.uid()
  ) into v_is_member;

  if not v_is_member then
    raise exception 'You are not a member of this group';
  end if;

  -- 3. Update Expense
  update expenses
  set 
    payer_id = p_payer_id,
    amount = p_amount,
    currency = p_currency,
    description = p_description
  where id = p_expense_id;

  -- 4. Delete Old Splits
  delete from expense_splits
  where expense_id = p_expense_id;

  -- 5. Insert New Splits
  -- We parse the JSONB array and insert
  insert into expense_splits (expense_id, user_id, owed_amount)
  select 
    p_expense_id,
    (x->>'user_id')::uuid,
    (x->>'amount')::numeric
  from jsonb_array_elements(p_splits) as x;

end;
$$;
