-- Add foreign key from activity_logs.actor_id to profiles.id
-- so PostgREST can resolve the join
ALTER TABLE activity_logs
  ADD CONSTRAINT activity_logs_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE CASCADE;
