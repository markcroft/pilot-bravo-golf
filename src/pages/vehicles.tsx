import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CalendarClock, ChevronRight } from "lucide-react";
import type { VehicleSummary } from "@shared/types";
import { getModel } from "@shared/models";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NewVehicleDialog } from "@/components/new-vehicle-dialog";
import { KindIcon } from "@/components/model-icon";

export function VehiclesPage() {
  const [vehicles, setVehicles] = useState<VehicleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.vehicles().then(setVehicles).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fleet</h1>
          <p className="text-sm text-muted-foreground">Pick a vehicle to inspect it or review its paint and corrosion history.</p>
        </div>
        <NewVehicleDialog />
      </div>

      {error && <p className="text-sm text-destructive">Couldn't load vehicles: {error}</p>}

      {!vehicles && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      )}

      {vehicles?.length === 0 && (
        <Card className="items-center py-14 text-center">
          <CardContent className="grid justify-items-center gap-3">
            <KindIcon kind="aircraft" className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No vehicles yet</p>
              <p className="text-sm text-muted-foreground">Add your first aircraft or vehicle to start logging inspections.</p>
            </div>
            <NewVehicleDialog />
          </CardContent>
        </Card>
      )}

      {!!vehicles?.length && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <Link key={v.id} to={`/vehicles/${v.id}`} className="group">
              <Card className="h-full gap-4 transition-shadow group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="grid size-10 place-items-center rounded-lg bg-muted">
                      <KindIcon kind={v.kind} className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate">{v.name}</CardTitle>
                      <CardDescription className="truncate">
                        {[v.identifier, getModel(v.model_id).name].filter(Boolean).join(" · ")}
                      </CardDescription>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2 text-sm">
                  {v.open_findings > 0 ? (
                    <Badge className="border-transparent bg-orange-600/15 text-orange-700 dark:text-orange-400">
                      <AlertTriangle />{v.open_findings} open
                    </Badge>
                  ) : (
                    <Badge variant="secondary">No open findings</Badge>
                  )}
                  <span className="text-muted-foreground">{v.total_findings} total</span>
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5" />
                    {v.last_inspection_at ? fmtDate(v.last_inspection_at) : "Never inspected"}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
