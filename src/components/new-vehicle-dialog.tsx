import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { MODELS } from "@shared/models";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ModelViewer } from "@/components/model-viewer";
import { KindIcon } from "@/components/model-icon";
import { cn } from "@/lib/utils";

export function NewVehicleDialog({ defaultModelId, trigger }: { defaultModelId?: string; trigger?: React.ReactNode }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [notes, setNotes] = useState("");
  const [modelId, setModelId] = useState(defaultModelId ?? MODELS[0].id);
  const [saving, setSaving] = useState(false);
  const model = MODELS.find((m) => m.id === modelId)!;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const v = await api.createVehicle({ name, identifier, notes, model_id: modelId, kind: model.kind });
      toast.success(`${v.name} added`);
      setOpen(false);
      nav(`/vehicles/${v.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus />Add vehicle</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Add a vehicle or aircraft</DialogTitle>
            <DialogDescription>Pick the 3D model inspectors will mark findings on.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid content-start gap-4">
              <div className="grid gap-2">
                <Label htmlFor="v-name">Name</Label>
                <Input id="v-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Trainer 3" autoFocus />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="v-id">Tail number / VIN / fleet no.</Label>
                <Input id="v-id" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="e.g. N172PB" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="v-notes">Notes</Label>
                <Textarea id="v-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Base, paint scheme, anything inspectors should know" />
              </div>
            </div>
            <div className="grid content-start gap-2">
              <Label>3D model</Label>
              <div className="h-40 overflow-hidden rounded-lg border">
                <ModelViewer model={model} autoRotate />
              </div>
              <div className="grid gap-1.5">
                {MODELS.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setModelId(m.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      m.id === modelId ? "border-primary bg-accent" : "hover:bg-accent/60",
                    )}
                  >
                    <KindIcon kind={m.kind} className="size-4 text-muted-foreground" />
                    <span className="flex-1">
                      <span className="font-medium">{m.name}</span>
                      <span className="block text-xs text-muted-foreground">{m.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !name.trim()}>{saving ? "Saving…" : "Add vehicle"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
