-- Migration 070: Client projects table
-- Idempotent

CREATE TABLE IF NOT EXISTS client_projects (
  id          BIGSERIAL PRIMARY KEY,
  client_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT 'blue',
  item_count  INTEGER DEFAULT 0,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_projects_client_id ON client_projects(client_id);

-- RLS
ALTER TABLE client_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_projects_select_own" ON client_projects;
CREATE POLICY "client_projects_select_own" ON client_projects
  FOR SELECT USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
    )
  );

DROP POLICY IF EXISTS "client_projects_insert_own" ON client_projects;
CREATE POLICY "client_projects_insert_own" ON client_projects
  FOR INSERT WITH CHECK (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
    )
  );

DROP POLICY IF EXISTS "client_projects_update_own" ON client_projects;
CREATE POLICY "client_projects_update_own" ON client_projects
  FOR UPDATE USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
    )
  );

DROP POLICY IF EXISTS "client_projects_delete_own" ON client_projects;
CREATE POLICY "client_projects_delete_own" ON client_projects
  FOR DELETE USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'vendedor')
    )
  );
