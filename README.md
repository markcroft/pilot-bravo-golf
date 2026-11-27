# pilot-bravo-golf: Corrosion Tracker

A prototype web app for logging paint and corrosion findings during walk-around visual
inspections of aircraft and ground vehicles. It replaces the paper printout: inspectors
tap the spot on an interactive 3D model, describe the issue, and attach photos. Each
vehicle keeps a full history of inspections, findings, photos and notes.

Runs entirely on Cloudflare Workers:

| Piece | What |
| --- | --- |
| Worker `pilot-bravo-golf` | [Hono](https://hono.dev) API under `/api/*`, and serves the React app as static assets |
| D1 `pilot-bravo-golf-db` | Vehicles, inspections, findings, photo metadata, notes |
| R2 `pilot-bravo-golf-photos` | Photo files, keyed `vehicles/<vehicle>/findings/<finding>/<photo>` |

Frontend: React 19, Vite, Tailwind v4, [shadcn/ui](https://ui.shadcn.com) (new-york style,
components in `src/components/ui`), and three.js via React Three Fiber / drei.

> **No authentication.** This is a pilot: anyone with the URL can read and change data.

## Features

- **Fleet list**: each vehicle shows its open findings and last inspection date.
- **Interactive 3D model**: orbit, zoom and pan, with Front / Rear / Left / Right / Top / Under
  view presets. Findings appear as pins colored by severity (green once repaired).
  Selecting a finding flies the camera to it.
- **Mark finding**: tap the model to drop a pin, then record type, severity, details and
  photos (use the device camera or choose existing images).
- **Inspections**: start a walk-around, and findings logged during it are grouped under it.
  The History tab lists past inspections; pick one to see only its findings.
- **Finding detail**: change status (Open / Monitoring / Repaired) and severity, view photos
  full size, add more photos, and keep a running notes thread.
- **Vehicle notes**: free-form notes per vehicle.
- **Model library** (`/models`): browse the available 3D models.

## 3D model library

Models live in `public/models` and are registered in `shared/models.ts`. Finding coordinates
are stored in the model's *normalized* space (centered, longest side = 10 units), so any
GLB can be added without tuning units.

| Model | Source | License |
| --- | --- | --- |
| Twin turboprop aircraft | [Cesium Air](https://github.com/CesiumGS/cesium/tree/main/Apps/SampleData/models/CesiumAir) | Apache-2.0 (CesiumJS sample data) |
| Armored utility vehicle | [Cesium GroundVehicle](https://github.com/CesiumGS/cesium/tree/main/Apps/SampleData/models/GroundVehicle) | Apache-2.0 (CesiumJS sample data) |
| Box truck | [Cesium Milk Truck](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMilkTruck) | CC-BY-4.0 |
| Pickup truck (low-poly) | [Kenney Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) | CC0 |

To add a model, drop a `.glb` into `public/models/` and add an entry to `MODELS` in
`shared/models.ts`. If it loads lying on its side, set `rotation`.

## Development

```bash
npm install
npm run db:migrate:local   # create the local D1 schema
npm run dev                # Vite + the Workers runtime, with local D1/R2
```

## Deploying

Pushes to `main` deploy automatically via GitHub Actions (`.github/workflows/deploy.yml`):
typecheck, apply D1 migrations, build, `wrangler deploy`. You can also run it by hand from
the Actions tab. It needs two repository secrets: `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`.

To deploy manually instead:

```bash
npm run db:migrate:remote  # apply migrations to the real D1 database
npm run deploy             # vite build + wrangler deploy
```

Wrangler needs `CLOUDFLARE_API_TOKEN` (Workers Scripts, D1 and R2 edit permissions) and
`CLOUDFLARE_ACCOUNT_ID`.

## API

| Method | Path | |
| --- | --- | --- |
| GET/POST | `/api/vehicles` | list (with counts) / create |
| GET/PATCH/DELETE | `/api/vehicles/:id` | |
| GET/POST | `/api/vehicles/:id/inspections` | history / start |
| PATCH/DELETE | `/api/inspections/:id` | complete, edit, delete (findings are kept) |
| GET/POST | `/api/vehicles/:id/findings` | list / create (with 3D position + normal) |
| GET/PATCH/DELETE | `/api/findings/:id` | detail includes photos and notes |
| POST | `/api/findings/:id/photos` | multipart `file` (repeatable), stored in R2 |
| GET/DELETE | `/api/photos/:id` | streams the image from R2 |
| POST | `/api/findings/:id/notes`, DELETE `/api/notes/:id` | |
