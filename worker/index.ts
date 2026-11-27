import { Hono } from "hono";
import { MODELS } from "../shared/models";
import type { FindingDetail } from "../shared/types";

type Env = { DB: D1Database; PHOTOS: R2Bucket };
type Row = Record<string, unknown>;

const app = new Hono<{ Bindings: Env }>().basePath("/api");

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

const SEVERITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["open", "monitoring", "repaired"];
const KINDS = ["aircraft", "ground"];

function pick<T extends Row>(body: Row, allowed: (keyof T & string)[]) {
  const out: Row = {};
  for (const k of allowed) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

async function update(db: D1Database, table: string, rowId: string, fields: Row) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`;
  await db.prepare(sql).bind(...keys.map((k) => fields[k] as never), rowId).run();
}

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || "Internal error" }, 500);
});

// ---------- Model library ----------
app.get("/models", (c) => c.json(MODELS));

// ---------- Vehicles ----------
app.get("/vehicles", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT v.*,
       (SELECT COUNT(*) FROM findings f WHERE f.vehicle_id = v.id AND f.status != 'repaired') AS open_findings,
       (SELECT COUNT(*) FROM findings f WHERE f.vehicle_id = v.id) AS total_findings,
       (SELECT MAX(started_at) FROM inspections i WHERE i.vehicle_id = v.id) AS last_inspection_at
     FROM vehicles v ORDER BY v.created_at DESC`,
  ).all();
  return c.json(results);
});

app.post("/vehicles", async (c) => {
  const b = await c.req.json<Row>();
  const name = String(b.name ?? "").trim();
  const model_id = String(b.model_id ?? "");
  if (!name) return c.json({ error: "Name is required" }, 400);
  const model = MODELS.find((m) => m.id === model_id);
  if (!model) return c.json({ error: "Unknown model" }, 400);
  const kind = KINDS.includes(String(b.kind)) ? String(b.kind) : model.kind;
  const row = {
    id: id(), name, kind, model_id,
    identifier: String(b.identifier ?? "").trim() || null,
    notes: String(b.notes ?? ""),
    created_at: now(),
  };
  await c.env.DB.prepare(
    "INSERT INTO vehicles (id, name, kind, identifier, model_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(row.id, row.name, row.kind, row.identifier, row.model_id, row.notes, row.created_at).run();
  return c.json(row, 201);
});

app.get("/vehicles/:id", async (c) => {
  const v = await c.env.DB.prepare("SELECT * FROM vehicles WHERE id = ?").bind(c.req.param("id")).first();
  return v ? c.json(v) : c.json({ error: "Not found" }, 404);
});

app.patch("/vehicles/:id", async (c) => {
  const fields = pick(await c.req.json<Row>(), ["name", "identifier", "notes", "model_id"]);
  if (fields.model_id && !MODELS.some((m) => m.id === fields.model_id)) return c.json({ error: "Unknown model" }, 400);
  await update(c.env.DB, "vehicles", c.req.param("id"), fields);
  const v = await c.env.DB.prepare("SELECT * FROM vehicles WHERE id = ?").bind(c.req.param("id")).first();
  return c.json(v);
});

app.delete("/vehicles/:id", async (c) => {
  const vid = c.req.param("id");
  const { results } = await c.env.DB.prepare(
    "SELECT p.r2_key FROM photos p JOIN findings f ON f.id = p.finding_id WHERE f.vehicle_id = ?",
  ).bind(vid).all<{ r2_key: string }>();
  if (results.length) await c.env.PHOTOS.delete(results.map((r) => r.r2_key));
  const db = c.env.DB;
  await db.batch([
    db.prepare("DELETE FROM finding_notes WHERE finding_id IN (SELECT id FROM findings WHERE vehicle_id = ?)").bind(vid),
    db.prepare("DELETE FROM photos WHERE finding_id IN (SELECT id FROM findings WHERE vehicle_id = ?)").bind(vid),
    db.prepare("DELETE FROM findings WHERE vehicle_id = ?").bind(vid),
    db.prepare("DELETE FROM inspections WHERE vehicle_id = ?").bind(vid),
    db.prepare("DELETE FROM vehicles WHERE id = ?").bind(vid),
  ]);
  return c.json({ ok: true });
});

// ---------- Inspections ----------
app.get("/vehicles/:id/inspections", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT i.*, (SELECT COUNT(*) FROM findings f WHERE f.inspection_id = i.id) AS finding_count
     FROM inspections i WHERE i.vehicle_id = ? ORDER BY i.started_at DESC`,
  ).bind(c.req.param("id")).all();
  return c.json(results);
});

app.post("/vehicles/:id/inspections", async (c) => {
  const b = await c.req.json<Row>().catch(() => ({}) as Row);
  const row = {
    id: id(), vehicle_id: c.req.param("id"),
    inspector: String(b.inspector ?? "").trim(), notes: String(b.notes ?? ""),
    status: "in_progress", started_at: now(), completed_at: null, finding_count: 0,
  };
  await c.env.DB.prepare(
    "INSERT INTO inspections (id, vehicle_id, inspector, notes, status, started_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(row.id, row.vehicle_id, row.inspector, row.notes, row.status, row.started_at).run();
  return c.json(row, 201);
});

app.patch("/inspections/:id", async (c) => {
  const b = await c.req.json<Row>();
  const fields = pick(b, ["inspector", "notes", "status"]);
  if (fields.status === "completed") fields.completed_at = now();
  if (fields.status === "in_progress") fields.completed_at = null;
  await update(c.env.DB, "inspections", c.req.param("id"), fields);
  const row = await c.env.DB.prepare("SELECT * FROM inspections WHERE id = ?").bind(c.req.param("id")).first();
  return c.json(row);
});

app.delete("/inspections/:id", async (c) => {
  // Findings are kept (they belong to the vehicle); they just lose the link.
  const db = c.env.DB;
  await db.batch([
    db.prepare("UPDATE findings SET inspection_id = NULL WHERE inspection_id = ?").bind(c.req.param("id")),
    db.prepare("DELETE FROM inspections WHERE id = ?").bind(c.req.param("id")),
  ]);
  return c.json({ ok: true });
});

// ---------- Findings ----------
app.get("/vehicles/:id/findings", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT f.*,
       (SELECT COUNT(*) FROM photos p WHERE p.finding_id = f.id) AS photo_count,
       (SELECT COUNT(*) FROM finding_notes n WHERE n.finding_id = f.id) AS note_count
     FROM findings f WHERE f.vehicle_id = ? ORDER BY f.created_at DESC`,
  ).bind(c.req.param("id")).all();
  return c.json(results);
});

app.post("/vehicles/:id/findings", async (c) => {
  const b = await c.req.json<Row>();
  const title = String(b.title ?? "").trim();
  if (!title) return c.json({ error: "Title is required" }, 400);
  const nums = ["pos_x", "pos_y", "pos_z", "nrm_x", "nrm_y", "nrm_z"].map((k) => Number(b[k] ?? 0));
  if (nums.some((n) => !Number.isFinite(n))) return c.json({ error: "Invalid position" }, 400);
  const row = {
    id: id(), vehicle_id: c.req.param("id"),
    inspection_id: (b.inspection_id as string) || null,
    title, category: String(b.category ?? "other"),
    severity: SEVERITIES.includes(String(b.severity)) ? String(b.severity) : "medium",
    status: "open", description: String(b.description ?? ""),
    created_at: now(),
  };
  await c.env.DB.prepare(
    `INSERT INTO findings (id, vehicle_id, inspection_id, title, category, severity, status, description,
       pos_x, pos_y, pos_z, nrm_x, nrm_y, nrm_z, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(row.id, row.vehicle_id, row.inspection_id, row.title, row.category, row.severity, row.status,
    row.description, ...nums, row.created_at).run();
  return c.json({ ...row, pos_x: nums[0], pos_y: nums[1], pos_z: nums[2], nrm_x: nums[3], nrm_y: nums[4], nrm_z: nums[5], resolved_at: null, photo_count: 0, note_count: 0 }, 201);
});

app.get("/findings/:id", async (c) => {
  const db = c.env.DB;
  const fid = c.req.param("id");
  const f = await db.prepare("SELECT * FROM findings WHERE id = ?").bind(fid).first();
  if (!f) return c.json({ error: "Not found" }, 404);
  const [photos, notes] = await Promise.all([
    db.prepare("SELECT id, finding_id, content_type, size, caption, created_at FROM photos WHERE finding_id = ? ORDER BY created_at").bind(fid).all(),
    db.prepare("SELECT * FROM finding_notes WHERE finding_id = ? ORDER BY created_at").bind(fid).all(),
  ]);
  return c.json({ ...f, photos: photos.results, notes: notes.results } as unknown as FindingDetail);
});

app.patch("/findings/:id", async (c) => {
  const b = await c.req.json<Row>();
  const fields = pick(b, ["title", "category", "severity", "status", "description"]);
  if (fields.severity && !SEVERITIES.includes(String(fields.severity))) return c.json({ error: "Bad severity" }, 400);
  if (fields.status) {
    if (!STATUSES.includes(String(fields.status))) return c.json({ error: "Bad status" }, 400);
    fields.resolved_at = fields.status === "repaired" ? now() : null;
  }
  await update(c.env.DB, "findings", c.req.param("id"), fields);
  const f = await c.env.DB.prepare("SELECT * FROM findings WHERE id = ?").bind(c.req.param("id")).first();
  return c.json(f);
});

app.delete("/findings/:id", async (c) => {
  const fid = c.req.param("id");
  const db = c.env.DB;
  const { results } = await db.prepare("SELECT r2_key FROM photos WHERE finding_id = ?").bind(fid).all<{ r2_key: string }>();
  if (results.length) await c.env.PHOTOS.delete(results.map((r) => r.r2_key));
  await db.batch([
    db.prepare("DELETE FROM finding_notes WHERE finding_id = ?").bind(fid),
    db.prepare("DELETE FROM photos WHERE finding_id = ?").bind(fid),
    db.prepare("DELETE FROM findings WHERE id = ?").bind(fid),
  ]);
  return c.json({ ok: true });
});

// ---------- Photos (R2) ----------
app.post("/findings/:id/photos", async (c) => {
  const fid = c.req.param("id");
  const finding = await c.env.DB.prepare("SELECT vehicle_id FROM findings WHERE id = ?").bind(fid).first<{ vehicle_id: string }>();
  if (!finding) return c.json({ error: "Not found" }, 404);
  const form = await c.req.formData();
  const caption = String(form.get("caption") ?? "");
  const files = form.getAll("file").filter((f): f is File => typeof f !== "string");
  if (!files.length) return c.json({ error: "No file uploaded" }, 400);
  const created = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) return c.json({ error: `${file.name} is not an image` }, 400);
    if (file.size > MAX_PHOTO_BYTES) return c.json({ error: `${file.name} is larger than 15 MB` }, 400);
    const pid = id();
    const key = `vehicles/${finding.vehicle_id}/findings/${fid}/${pid}`;
    await c.env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    const row = { id: pid, finding_id: fid, content_type: file.type, size: file.size, caption, created_at: now() };
    await c.env.DB.prepare(
      "INSERT INTO photos (id, finding_id, r2_key, content_type, size, caption, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(pid, fid, key, row.content_type, row.size, row.caption, row.created_at).run();
    created.push(row);
  }
  return c.json(created, 201);
});

app.get("/photos/:id", async (c) => {
  const p = await c.env.DB.prepare("SELECT r2_key, content_type FROM photos WHERE id = ?").bind(c.req.param("id")).first<{ r2_key: string; content_type: string }>();
  if (!p) return c.json({ error: "Not found" }, 404);
  const obj = await c.env.PHOTOS.get(p.r2_key);
  if (!obj) return c.json({ error: "Photo missing from storage" }, 404);
  return new Response(obj.body, {
    headers: {
      "Content-Type": p.content_type,
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: obj.httpEtag,
    },
  });
});

app.delete("/photos/:id", async (c) => {
  const p = await c.env.DB.prepare("SELECT r2_key FROM photos WHERE id = ?").bind(c.req.param("id")).first<{ r2_key: string }>();
  if (!p) return c.json({ error: "Not found" }, 404);
  await c.env.PHOTOS.delete(p.r2_key);
  await c.env.DB.prepare("DELETE FROM photos WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

// ---------- Notes ----------
app.post("/findings/:id/notes", async (c) => {
  const b = await c.req.json<Row>();
  const body = String(b.body ?? "").trim();
  if (!body) return c.json({ error: "Note is empty" }, 400);
  const row = { id: id(), finding_id: c.req.param("id"), author: String(b.author ?? "").trim(), body, created_at: now() };
  await c.env.DB.prepare("INSERT INTO finding_notes (id, finding_id, author, body, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(row.id, row.finding_id, row.author, row.body, row.created_at).run();
  return c.json(row, 201);
});

app.delete("/notes/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM finding_notes WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

app.all("*", (c) => c.json({ error: "Not found" }, 404));

export default app;
