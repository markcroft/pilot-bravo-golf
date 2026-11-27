export type VehicleKind = "aircraft" | "ground";
export type Severity = "low" | "medium" | "high" | "critical";
export type FindingStatus = "open" | "monitoring" | "repaired";
export type InspectionStatus = "in_progress" | "completed";

export const CATEGORIES = [
  { value: "corrosion", label: "Corrosion" },
  { value: "paint_chip", label: "Paint chip" },
  { value: "blistering", label: "Blistering / bubbling" },
  { value: "peeling", label: "Peeling / flaking" },
  { value: "scratch", label: "Scratch / scuff" },
  { value: "fading", label: "Fading / chalking" },
  { value: "filiform", label: "Filiform corrosion" },
  { value: "other", label: "Other" },
] as const;
export type Category = (typeof CATEGORIES)[number]["value"];

export const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const STATUSES: { value: FindingStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "monitoring", label: "Monitoring" },
  { value: "repaired", label: "Repaired" },
];

export interface Vehicle {
  id: string;
  name: string;
  kind: VehicleKind;
  identifier: string | null;
  model_id: string;
  notes: string;
  created_at: string;
}

export interface VehicleSummary extends Vehicle {
  open_findings: number;
  total_findings: number;
  last_inspection_at: string | null;
}

export interface Inspection {
  id: string;
  vehicle_id: string;
  inspector: string;
  notes: string;
  status: InspectionStatus;
  started_at: string;
  completed_at: string | null;
  finding_count?: number;
}

export interface Finding {
  id: string;
  vehicle_id: string;
  inspection_id: string | null;
  title: string;
  category: Category;
  severity: Severity;
  status: FindingStatus;
  description: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  nrm_x: number;
  nrm_y: number;
  nrm_z: number;
  created_at: string;
  resolved_at: string | null;
  photo_count?: number;
  note_count?: number;
}

export interface Photo {
  id: string;
  finding_id: string;
  content_type: string;
  size: number;
  caption: string;
  created_at: string;
}

export interface FindingNote {
  id: string;
  finding_id: string;
  author: string;
  body: string;
  created_at: string;
}

export interface FindingDetail extends Finding {
  photos: Photo[];
  notes: FindingNote[];
}
