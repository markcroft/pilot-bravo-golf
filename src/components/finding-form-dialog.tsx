import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CATEGORIES, SEVERITIES, type Category, type Finding, type Inspection, type Severity } from "@shared/types";
import { api } from "@/lib/api";
import type { PickedPoint } from "@/components/model-viewer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PhotoPicker } from "@/components/photo-picker";
import { SeverityDot } from "@/components/finding-badges";
import { fmtDate } from "@/lib/format";

interface Props {
  vehicleId: string;
  point: PickedPoint | null;
  inspection: Inspection | null;
  onClose: () => void;
  onCreated: (f: Finding) => void;
}

export function FindingFormDialog({ vehicleId, point, inspection, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("corrosion");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (point) { setTitle(""); setDescription(""); setFiles([]); setSeverity("medium"); setCategory("corrosion"); }
  }, [point]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!point) return;
    setSaving(true);
    try {
      const f = await api.createFinding(vehicleId, {
        title, category, severity, description,
        inspection_id: inspection?.id ?? null,
        pos_x: point.position[0], pos_y: point.position[1], pos_z: point.position[2],
        nrm_x: point.normal[0], nrm_y: point.normal[1], nrm_z: point.normal[2],
      });
      if (files.length) {
        try {
          await api.uploadPhotos(f.id, files);
          f.photo_count = files.length;
        } catch (err) {
          toast.error(`Finding saved, but photos failed to upload: ${(err as Error).message}`);
        }
      }
      toast.success("Finding logged");
      onCreated(f);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!point} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Log a finding</DialogTitle>
            <DialogDescription>
              {inspection
                ? `Adding to the inspection started ${fmtDate(inspection.started_at)}${inspection.inspector ? ` by ${inspection.inspector}` : ""}.`
                : "Not part of an inspection. Start one first to group findings by walk-around."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="f-title">Short description</Label>
            <Input id="f-title" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bubbling under paint, left wing root" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}><SeverityDot severity={s.value} />{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="f-desc">Details</Label>
            <Textarea id="f-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Size, depth, extent, suggested repair…" />
          </div>
          <div className="grid gap-2">
            <Label>Photos</Label>
            <PhotoPicker files={files} onChange={setFiles} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !title.trim()}>{saving ? "Saving…" : "Save finding"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
