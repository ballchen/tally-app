-- Optimize all remaining RLS policies that use is_group_member()
-- Replace function calls with direct EXISTS subqueries for better performance

-- ============================================
-- EXPENSES TABLE
-- ============================================

DROP POLICY IF EXISTS "View expenses" ON expenses;

CREATE POLICY "View expenses" ON expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = expenses.group_id
      AND group_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create expenses" ON expenses;

CREATE POLICY "Users can create expenses" ON expenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = expenses.group_id
      AND group_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Group members can delete expenses" ON expenses;

CREATE POLICY "Group members can delete expenses" ON expenses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = expenses.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- ============================================
-- EXPENSE_SPLITS TABLE
-- ============================================

DROP POLICY IF EXISTS "View splits" ON expense_splits;

CREATE POLICY "View splits" ON expense_splits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM expenses e
      INNER JOIN group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_splits.expense_id
      AND gm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Insert splits" ON expense_splits;

CREATE POLICY "Insert splits" ON expense_splits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses e
      INNER JOIN group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_splits.expense_id
      AND gm.user_id = auth.uid()
    )
  );

-- ============================================
-- SETTLEMENTS TABLE
-- ============================================

DROP POLICY IF EXISTS "View settlements" ON settlements;

CREATE POLICY "View settlements" ON settlements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = settlements.group_id
      AND group_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create settlements" ON settlements;

CREATE POLICY "Users can create settlements" ON settlements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = settlements.group_id
      AND group_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Delete settlements" ON settlements;

CREATE POLICY "Delete settlements" ON settlements
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = settlements.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- ============================================
-- ADD INDEXES FOR OPTIMIZATION
-- ============================================

-- Index for expenses.group_id lookups
CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON expenses(group_id);

-- Index for settlements.group_id lookups
CREATE INDEX IF NOT EXISTS idx_settlements_group_id ON settlements(group_id);

-- Index for expense_splits.expense_id lookups
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);

-- ============================================
-- ADD COMMENTS
-- ============================================

COMMENT ON POLICY "View expenses" ON expenses IS
'Users can view expenses in groups where they are members. Optimized with EXISTS subquery.';

COMMENT ON POLICY "View splits" ON expense_splits IS
'Users can view expense splits for expenses in their groups. Optimized with JOIN in EXISTS.';

COMMENT ON POLICY "View settlements" ON settlements IS
'Users can view settlements in groups where they are members. Optimized with EXISTS subquery.';
