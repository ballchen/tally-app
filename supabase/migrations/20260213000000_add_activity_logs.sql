-- Activity logs table for audit trail
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  changes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_group_time ON activity_logs(group_id, created_at DESC);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view logs"
  ON activity_logs FOR SELECT
  USING (is_group_member(group_id));

-- RPC for frontend to write logs (SECURITY DEFINER so it bypasses INSERT RLS)
CREATE OR REPLACE FUNCTION log_activity(
  p_group_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_changes JSONB DEFAULT '{}'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO activity_logs (group_id, actor_id, action, entity_type, entity_id, changes)
  VALUES (p_group_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_changes)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;
