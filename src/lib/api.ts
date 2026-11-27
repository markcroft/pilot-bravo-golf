import type {
  Finding, FindingDetail, FindingNote, Inspection, Photo, Vehicle, VehicleSummary,
} from "@shared/types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body instanceof FormData ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}
const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  vehicles: () => req<VehicleSummary[]>("/vehicles"),
  vehicle: (id: string) => req<Vehicle>(`/vehicles/${id}`),
  createVehicle: (b: Partial<Vehicle>) => req<Vehicle>("/vehicles", json("POST", b)),
  updateVehicle: (id: string, b: Partial<Vehicle>) => req<Vehicle>(`/vehicles/${id}`, json("PATCH", b)),
  deleteVehicle: (id: string) => req(`/vehicles/${id}`, json("DELETE")),

  inspections: (vid: string) => req<Inspection[]>(`/vehicles/${vid}/inspections`),
  startInspection: (vid: string, b: Partial<Inspection>) => req<Inspection>(`/vehicles/${vid}/inspections`, json("POST", b)),
  updateInspection: (id: string, b: Partial<Inspection>) => req<Inspection>(`/inspections/${id}`, json("PATCH", b)),
  deleteInspection: (id: string) => req(`/inspections/${id}`, json("DELETE")),

  findings: (vid: string) => req<Finding[]>(`/vehicles/${vid}/findings`),
  finding: (id: string) => req<FindingDetail>(`/findings/${id}`),
  createFinding: (vid: string, b: Partial<Finding>) => req<Finding>(`/vehicles/${vid}/findings`, json("POST", b)),
  updateFinding: (id: string, b: Partial<Finding>) => req<Finding>(`/findings/${id}`, json("PATCH", b)),
  deleteFinding: (id: string) => req(`/findings/${id}`, json("DELETE")),

  uploadPhotos: (fid: string, files: File[], caption = "") => {
    const fd = new FormData();
    files.forEach((f) => fd.append("file", f));
    fd.append("caption", caption);
    return req<Photo[]>(`/findings/${fid}/photos`, { method: "POST", body: fd });
  },
  photoUrl: (id: string) => `/api/photos/${id}`,
  deletePhoto: (id: string) => req(`/photos/${id}`, json("DELETE")),

  addNote: (fid: string, b: { body: string; author: string }) => req<FindingNote>(`/findings/${fid}/notes`, json("POST", b)),
  deleteNote: (id: string) => req(`/notes/${id}`, json("DELETE")),
};

/** Remembers the inspector's name on this device (a convenience, not auth). */
export const inspectorName = {
  get: () => { try { return localStorage.getItem("inspectorName") ?? ""; } catch { return ""; } },
  set: (v: string) => { try { localStorage.setItem("inspectorName", v); } catch { /* ignore */ } },
};
