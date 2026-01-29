-- 1. 刪除舊的 SELECT Policy
DROP POLICY "View expenses" ON expenses;

-- 2. 建立新的 SELECT Policy (拿掉 deleted_at 限制)
CREATE POLICY "View expenses" ON expenses
FOR SELECT
USING (
  is_group_member(group_id)
);