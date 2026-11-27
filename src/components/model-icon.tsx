import { Plane, Truck } from "lucide-react";
import type { VehicleKind } from "@shared/types";

export function KindIcon({ kind, className }: { kind: VehicleKind; className?: string }) {
  return kind === "aircraft" ? <Plane className={className} /> : <Truck className={className} />;
}
