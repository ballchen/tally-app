-- Enable Supabase Realtime for specific tables
-- This allows clients to subscribe to changes on these tables

-- Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE expense_splits;
