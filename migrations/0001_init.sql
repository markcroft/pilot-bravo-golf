-- Vehicles / aircraft being tracked
CREATE TABLE vehicles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'aircraft',      -- aircraft | ground
  identifier TEXT,                             -- tail number, VIN, fleet number
  model_id TEXT NOT NULL,                      -- key into the 3D model library
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- A walk-around visual inspection session
CREATE TABLE inspections (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  inspector TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'in_progress',  -- in_progress | completed
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT
);
CREATE INDEX idx_inspections_vehicle ON inspections(vehicle_id, started_at);

-- A paint / corrosion issue pinned to a point on the 3D model
CREATE TABLE findings (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  inspection_id TEXT REFERENCES inspections(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,                      -- corrosion | paint_chip | blistering | ...
  severity TEXT NOT NULL DEFAULT 'medium',     -- low | medium | high | critical
  status TEXT NOT NULL DEFAULT 'open',         -- open | monitoring | repaired
  description TEXT NOT NULL DEFAULT '',
  pos_x REAL NOT NULL, pos_y REAL NOT NULL, pos_z REAL NOT NULL,
  nrm_x REAL NOT NULL DEFAULT 0, nrm_y REAL NOT NULL DEFAULT 1, nrm_z REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at TEXT
);
CREATE INDEX idx_findings_vehicle ON findings(vehicle_id, created_at);
CREATE INDEX idx_findings_inspection ON findings(inspection_id);

-- Photos stored in R2, attached to a finding
CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  caption TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_photos_finding ON photos(finding_id);

-- Running notes / comments on a finding
CREATE TABLE finding_notes (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  author TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_notes_finding ON finding_notes(finding_id, created_at);
