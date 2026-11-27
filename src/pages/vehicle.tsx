import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  ArrowLeft, Camera, CheckCircle2, ClipboardList, Crosshair, Eye, EyeOff, MessageSquare, Play, RotateCcw, Trash2, X,
} from "lucide-react";
import { getModel } from "@shared/models";
import type { Finding, Inspection, Vehicle } from "@shared/types";
import { api, inspectorName } from "@/lib/api";
import { categoryLabel, fmtDate, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ModelViewer, type PickedPoint, type ViewPreset } from "@/components/model-viewer";
import { FindingFormDialog } from "@/components/finding-form-dialog";
import { FindingSheet } from "@/components/finding-sheet";
import { SeverityDot, StatusBadge } from "@/components/finding-badges";
import { KindIcon } from "@/components/model-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Filter = "open" | "all" | `insp:${string}`;

const VIEWS: { preset: ViewPreset; label: string }[] = [
  { preset: "front", label: "Front" },
  { preset: "back", label: "Rear" },
  { preset: "left", label: "Left" },
  { preset: "right", label: "Right" },
  { preset: "top", label: "Top" },
  { preset: "bottom", label: "Under" },
];

export function VehiclePage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [placing, setPlacing] = useState(false);
  const [pending, setPending] = useState<PickedPoint | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [showPins, setShowPins] = useState(true);
  const [view, setView] = useState<{ preset: ViewPreset; nonce: number }>();
  const [startOpen, setStartOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [v, f, i] = await Promise.all([api.vehicle(id), api.findings(id), api.inspections(id)]);
      setVehicle(v); setFindings(f); setInspections(i);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const active = inspections.find((i) => i.status === "in_progress") ?? null;
  const model = vehicle ? getModel(vehicle.model_id) : null;

  const visible = useMemo(() => {
    if (filter === "all") return findings;
    if (filter === "open") return findings.filter((f) => f.status !== "repaired");
    const iid = filter.slice(5);
    return findings.filter((f) => f.inspection_id === iid);
  }, [findings, filter]);

  const counts = useMemo(() => ({
    open: findings.filter((f) => f.status === "open").length,
    monitoring: findings.filter((f) => f.status === "monitoring").length,
    repaired: findings.filter((f) => f.status === "repaired").length,
  }), [findings]);

  // Escape cancels placement.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setPlacing(false); setPending(null); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const onPick = (p: PickedPoint) => { setPending(p); setPlacing(false); };

  const onCreated = (f: Finding) => {
    setFindings((xs) => [f, ...xs]);
    setInspections((xs) => xs.map((i) => (i.id === f.inspection_id ? { ...i, finding_count: (i.finding_count ?? 0) + 1 } : i)));
    setPending(null);
    setSelectedId(f.id);
    if (filter !== "all" && !filter.startsWith("insp:")) setFilter("open");
  };

  const completeInspection = async () => {
    if (!active) return;
    const i = await api.updateInspection(active.id, { status: "completed" });
    setInspections((xs) => xs.map((x) => (x.id === i.id ? { ...x, ...i } : x)));
    toast.success("Inspection completed");
  };

  if (error) {
    return (
      <div className="grid min-h-full place-items-center p-6 text-center">
        <div className="grid gap-3">
          <p className="text-destructive">Couldn't load this vehicle: {error}</p>
          <Button asChild variant="outline"><Link to="/">Back to fleet</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-3 sm:px-4">
        <Button variant="ghost" size="icon" asChild><Link to="/" aria-label="Back to fleet"><ArrowLeft /></Link></Button>
        {vehicle ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <KindIcon kind={vehicle.kind} className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <h1 className="truncate leading-tight font-semibold">{vehicle.name}</h1>
              <p className="truncate text-xs text-muted-foreground">{[vehicle.identifier, model?.name].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        ) : (
          <Skeleton className="h-8 w-48" />
        )}
        <div className="ml-auto flex items-center gap-2">
          {active ? (
            <Button size="sm" variant="outline" onClick={completeInspection}>
              <CheckCircle2 className="text-green-600" /><span className="hidden sm:inline">Complete inspection</span><span className="sm:hidden">Done</span>
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStartOpen(true)}><Play /><span className="hidden sm:inline">Start inspection</span><span className="sm:hidden">Inspect</span></Button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {active && (
        <div className="flex shrink-0 items-center gap-2 border-b bg-orange-500/10 px-4 py-1.5 text-sm">
          <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-500 opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-orange-500" /></span>
          <span className="truncate">
            Inspection in progress · started {fmtDateTime(active.started_at)}{active.inspector ? ` by ${active.inspector}` : ""} · {active.finding_count ?? 0} finding{active.finding_count === 1 ? "" : "s"}
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* 3D viewer */}
        <div className="relative h-[55dvh] shrink-0 lg:h-auto lg:flex-1">
          {model ? (
            <ModelViewer
              model={model}
              findings={showPins ? visible : []}
              selectedId={selectedId}
              placing={placing}
              pending={pending}
              view={view}
              onPick={onPick}
              onSelect={setSelectedId}
            >
              {/* Toolbar */}
              <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start gap-2 p-3">
                <div className="pointer-events-auto flex gap-2">
                  <Button
                    size="sm"
                    variant={placing ? "destructive" : "default"}
                    onClick={() => { setPlacing((p) => !p); setPending(null); setSelectedId(null); }}
                    className="shadow-md"
                  >
                    {placing ? <><X />Cancel</> : <><Crosshair />Mark finding</>}
                  </Button>
                </div>
                <div className="pointer-events-auto ml-auto flex max-w-full flex-nowrap gap-0.5 overflow-x-auto rounded-lg border bg-background/85 p-1 shadow-sm backdrop-blur">
                  {VIEWS.map((v) => (
                    <Button key={v.preset} size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={() => setView({ preset: v.preset, nonce: Date.now() })}>
                      {v.label}
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" className="h-7 px-2" aria-label="Reset view" onClick={() => setView({ preset: "iso", nonce: Date.now() })}>
                    <RotateCcw className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" aria-label={showPins ? "Hide pins" : "Show pins"} onClick={() => setShowPins((s) => !s)}>
                    {showPins ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  </Button>
                </div>
              </div>
              {placing && (
                <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-3">
                  <div className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg">
                    Tap the spot on the model where you see the issue
                  </div>
                </div>
              )}
              {/* Legend */}
              <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded-md border bg-background/85 px-2.5 py-1.5 text-xs backdrop-blur">
                {(["low", "medium", "high", "critical"] as const).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 capitalize"><SeverityDot severity={s} />{s}</span>
                ))}
                <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-green-500" />repaired</span>
              </div>
            </ModelViewer>
          ) : (
            <Skeleton className="size-full rounded-none" />
          )}
        </div>

        {/* Side panel */}
        <aside className="flex min-h-0 flex-1 flex-col border-t lg:w-[400px] lg:flex-none lg:border-t-0 lg:border-l">
          <Tabs defaultValue="findings" className="min-h-0 flex-1 gap-0">
            <div className="border-b px-3 py-2">
              <TabsList className="w-full">
                <TabsTrigger value="findings">Findings <Badge variant="secondary" className="h-4 px-1.5">{counts.open + counts.monitoring}</Badge></TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="findings" className="flex min-h-0 flex-col">
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                  <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Unresolved ({counts.open + counts.monitoring})</SelectItem>
                    <SelectItem value="all">All findings ({findings.length})</SelectItem>
                    {inspections.map((i) => (
                      <SelectItem key={i.id} value={`insp:${i.id}`}>
                        Inspection {fmtDate(i.started_at)}{i.inspector ? ` · ${i.inspector}` : ""} ({i.finding_count ?? 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {visible.length === 0 ? (
                  <div className="grid justify-items-center gap-2 p-8 text-center text-sm text-muted-foreground">
                    <ClipboardList className="size-8" />
                    {findings.length === 0 ? "No findings logged yet. Tap “Mark finding”, then tap the model." : "Nothing matches this filter."}
                  </div>
                ) : (
                  <ul className="divide-y">
                    {visible.map((f) => (
                      <li key={f.id}>
                        <button
                          onClick={() => setSelectedId(f.id)}
                          className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60", f.id === selectedId && "bg-accent")}
                        >
                          <SeverityDot severity={f.severity} className={cn("mt-1.5", f.status === "repaired" && "bg-green-500")} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">{f.title}</span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                              <span>{categoryLabel(f.category)}</span>
                              <span>{fmtDate(f.created_at)}</span>
                              {!!f.photo_count && <span className="inline-flex items-center gap-0.5"><Camera className="size-3" />{f.photo_count}</span>}
                              {!!f.note_count && <span className="inline-flex items-center gap-0.5"><MessageSquare className="size-3" />{f.note_count}</span>}
                            </div>
                          </div>
                          <StatusBadge status={f.status} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="min-h-0 overflow-y-auto">
              {inspections.length === 0 ? (
                <div className="grid justify-items-center gap-3 p-8 text-center text-sm text-muted-foreground">
                  No inspections yet.
                  <Button size="sm" onClick={() => setStartOpen(true)}><Play />Start the first one</Button>
                </div>
              ) : (
                <ol className="relative mx-4 my-4 border-l pl-5">
                  {inspections.map((i) => (
                    <li key={i.id} className="group relative mb-5 last:mb-0">
                      <span className={cn("absolute top-1.5 -left-[26px] size-2.5 rounded-full ring-4 ring-background", i.status === "in_progress" ? "bg-orange-500" : "bg-muted-foreground")} />
                      <div className="flex items-start gap-2">
                        <button className="min-w-0 flex-1 text-left" onClick={() => setFilter(`insp:${i.id}`)}>
                          <p className="text-sm font-medium">{fmtDateTime(i.started_at)}</p>
                          <p className="text-xs text-muted-foreground">
                            {i.inspector || "Unknown inspector"} · {i.finding_count ?? 0} finding{i.finding_count === 1 ? "" : "s"} ·{" "}
                            {i.status === "in_progress" ? "in progress" : `completed ${fmtDate(i.completed_at)}`}
                          </p>
                          {i.notes && <p className="mt-1 text-sm whitespace-pre-wrap">{i.notes}</p>}
                          <span className="text-xs text-primary underline-offset-2 group-hover:underline">Show findings →</span>
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="size-7 opacity-0 group-hover:opacity-100" aria-label="Delete inspection"><Trash2 className="size-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this inspection record?</AlertDialogTitle>
                              <AlertDialogDescription>Its findings are kept on the vehicle; they just won't be grouped under this inspection.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={async () => { await api.deleteInspection(i.id); if (filter === `insp:${i.id}`) setFilter("open"); load(); }}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>

            <TabsContent value="notes" className="min-h-0 overflow-y-auto p-4">
              {vehicle && <VehicleNotes vehicle={vehicle} onSaved={setVehicle} onDeleted={() => nav("/")} />}
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      <FindingFormDialog vehicleId={id} point={pending} inspection={active} onClose={() => setPending(null)} onCreated={onCreated} />
      <FindingSheet
        findingId={selectedId}
        inspections={inspections}
        onClose={() => setSelectedId(null)}
        onChanged={(f) => setFindings((xs) => xs.map((x) => (x.id === f.id ? { ...x, ...f } : x)))}
        onDeleted={(fid) => { setFindings((xs) => xs.filter((x) => x.id !== fid)); setSelectedId(null); load(); }}
      />
      <StartInspectionDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        onStart={async (inspector, notes) => {
          inspectorName.set(inspector);
          const i = await api.startInspection(id, { inspector, notes });
          setInspections((xs) => [i, ...xs]);
          setStartOpen(false);
          toast.success("Inspection started. Mark findings on the model as you walk around.");
        }}
      />
    </div>
  );
}

function StartInspectionDialog({
  open, onOpenChange, onStart,
}: { open: boolean; onOpenChange: (o: boolean) => void; onStart: (inspector: string, notes: string) => Promise<void> }) {
  const [inspector, setInspector] = useState(inspectorName.get());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try { await onStart(inspector.trim(), notes); setNotes(""); } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
          }}
        >
          <DialogHeader>
            <DialogTitle>Start an inspection</DialogTitle>
            <DialogDescription>Findings you mark until you complete it are grouped under this walk-around.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="i-name">Inspector</Label>
            <Input id="i-name" value={inspector} onChange={(e) => setInspector(e.target.value)} placeholder="Your name" autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="i-notes">Notes (optional)</Label>
            <Textarea id="i-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conditions, location, reason for inspection…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}><Play />Start</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VehicleNotes({ vehicle, onSaved, onDeleted }: { vehicle: Vehicle; onSaved: (v: Vehicle) => void; onDeleted: () => void }) {
  const [name, setName] = useState(vehicle.name);
  const [identifier, setIdentifier] = useState(vehicle.identifier ?? "");
  const [notes, setNotes] = useState(vehicle.notes);
  const [saving, setSaving] = useState(false);
  const dirty = name !== vehicle.name || identifier !== (vehicle.identifier ?? "") || notes !== vehicle.notes;
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try { onSaved(await api.updateVehicle(vehicle.id, { name, identifier, notes })); toast.success("Saved"); }
        catch (err) { toast.error((err as Error).message); }
        finally { setSaving(false); }
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="vn-name">Name</Label>
        <Input id="vn-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="vn-id">Tail number / VIN / fleet no.</Label>
        <Input id="vn-id" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="vn-notes">Vehicle notes</Label>
        <Textarea id="vn-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-40" placeholder="Paint scheme, coating history, recurring problem areas, maintenance contacts…" />
      </div>
      <div className="flex items-center justify-between">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 />Delete vehicle</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {vehicle.name}?</AlertDialogTitle>
              <AlertDialogDescription>This permanently deletes every inspection, finding, photo and note for this vehicle.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async () => { await api.deleteVehicle(vehicle.id); toast.success("Vehicle deleted"); onDeleted(); }}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button type="submit" disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
