import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, Send, Trash2 } from "lucide-react";
import { SEVERITIES, STATUSES, type Finding, type FindingDetail, type FindingStatus, type Inspection, type Severity } from "@shared/types";
import { api, inspectorName } from "@/lib/api";
import { categoryLabel, fmtDate, fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SeverityDot, StatusBadge } from "@/components/finding-badges";

interface Props {
  findingId: string | null;
  inspections: Inspection[];
  onClose: () => void;
  onChanged: (f: Partial<Finding> & { id: string }) => void;
  onDeleted: (id: string) => void;
}

export function FindingSheet({ findingId, inspections, onClose, onChanged, onDeleted }: Props) {
  const [detail, setDetail] = useState<FindingDetail | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [author, setAuthor] = useState(inspectorName.get());
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState("");

  const load = useCallback(async (id: string) => {
    try {
      const d = await api.finding(id);
      setDetail(d);
      setDescDraft(d.description);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  useEffect(() => {
    setDetail(null);
    if (findingId) { setAuthor(inspectorName.get()); load(findingId); }
  }, [findingId, load]);

  const patch = async (b: Partial<Finding>) => {
    if (!detail) return;
    try {
      const f = await api.updateFinding(detail.id, b);
      setDetail({ ...detail, ...f });
      onChanged(f);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const upload = async (list: FileList | null) => {
    if (!detail || !list?.length) return;
    setUploading(true);
    try {
      const photos = await api.uploadPhotos(detail.id, Array.from(list));
      const next = { ...detail, photos: [...detail.photos, ...photos] };
      setDetail(next);
      onChanged({ id: detail.id, photo_count: next.photos.length });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (pid: string) => {
    if (!detail) return;
    await api.deletePhoto(pid);
    const next = { ...detail, photos: detail.photos.filter((p) => p.id !== pid) };
    setDetail(next);
    onChanged({ id: detail.id, photo_count: next.photos.length });
    setLightbox(null);
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !noteBody.trim()) return;
    inspectorName.set(author);
    try {
      const n = await api.addNote(detail.id, { body: noteBody, author });
      setDetail({ ...detail, notes: [...detail.notes, n] });
      onChanged({ id: detail.id, note_count: detail.notes.length + 1 });
      setNoteBody("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeFinding = async () => {
    if (!detail) return;
    await api.deleteFinding(detail.id);
    toast.success("Finding deleted");
    onDeleted(detail.id);
  };

  const insp = detail?.inspection_id ? inspections.find((i) => i.id === detail.inspection_id) : null;

  return (
    <>
      <Sheet open={!!findingId} onOpenChange={(o) => !o && onClose()} modal={false}>
        <SheetContent className="gap-0 overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          {!detail ? (
            <div className="grid gap-3 p-4">
              <SheetTitle className="sr-only">Loading finding</SheetTitle>
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32" />
            </div>
          ) : (
            <>
              <SheetHeader className="pr-10">
                <div className="flex items-center gap-2"><StatusBadge status={detail.status} /></div>
                <SheetTitle className="text-lg">{detail.title}</SheetTitle>
                <SheetDescription>
                  {categoryLabel(detail.category)} · found {fmtDate(detail.created_at)}
                  {insp ? ` during the ${fmtDate(insp.started_at)} inspection` : ""}
                  {detail.resolved_at ? ` · repaired ${fmtDate(detail.resolved_at)}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="grid gap-5 px-4 pb-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={detail.status} onValueChange={(v) => patch({ status: v as FindingStatus })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Severity</Label>
                    <Select value={detail.severity} onValueChange={(v) => patch({ severity: v as Severity })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SEVERITIES.map((s) => (
                          <SelectItem key={s.value} value={s.value}><SeverityDot severity={s.value} />{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Details</Label>
                  <Textarea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    onBlur={() => descDraft !== detail.description && patch({ description: descDraft })}
                    placeholder="No details recorded"
                  />
                </div>

                <Separator />

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Photos ({detail.photos.length})</h3>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" asChild disabled={uploading}>
                        <label className="cursor-pointer">
                          <Camera />
                          <span className="sr-only sm:not-sr-only">Camera</span>
                          <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
                        </label>
                      </Button>
                      <Button size="sm" variant="ghost" asChild disabled={uploading}>
                        <label className="cursor-pointer">
                          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                          <span className="sr-only sm:not-sr-only">Upload</span>
                          <input type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
                        </label>
                      </Button>
                    </div>
                  </div>
                  {detail.photos.length === 0 ? (
                    <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No photos yet</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {detail.photos.map((p) => (
                        <button key={p.id} onClick={() => setLightbox(p.id)} className="aspect-square overflow-hidden rounded-md border">
                          <img src={api.photoUrl(p.id)} alt={p.caption || detail.title} loading="lazy" className="size-full object-cover transition-transform hover:scale-105" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="grid gap-3">
                  <h3 className="text-sm font-medium">Notes ({detail.notes.length})</h3>
                  {detail.notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
                  <ol className="grid gap-3">
                    {detail.notes.map((n) => (
                      <li key={n.id} className="group rounded-md bg-muted/60 p-3 text-sm">
                        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{n.author || "Anonymous"}</span>
                          <span>{fmtDateTime(n.created_at)}</span>
                          <button
                            className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                            aria-label="Delete note"
                            onClick={async () => {
                              await api.deleteNote(n.id);
                              setDetail({ ...detail, notes: detail.notes.filter((x) => x.id !== n.id) });
                              onChanged({ id: detail.id, note_count: detail.notes.length - 1 });
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <p className="whitespace-pre-wrap">{n.body}</p>
                      </li>
                    ))}
                  </ol>
                  <form onSubmit={addNote} className="grid gap-2">
                    <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" className="h-8" />
                    <div className="flex gap-2">
                      <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Add a note: repair scheduled, re-checked, etc." className="min-h-10" />
                      <Button type="submit" size="icon" disabled={!noteBody.trim()} aria-label="Add note"><Send /></Button>
                    </div>
                  </form>
                </div>

                <Separator />

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="justify-self-start text-destructive hover:text-destructive">
                      <Trash2 />Delete finding
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this finding?</AlertDialogTitle>
                      <AlertDialogDescription>Its photos and notes are deleted too. To keep the history, mark it Repaired instead.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={removeFinding}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] gap-3 p-3 sm:max-w-4xl">
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {lightbox && (
            <>
              <img src={api.photoUrl(lightbox)} alt="" className="max-h-[75dvh] w-full rounded-md object-contain" />
              <div className="flex justify-between gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={api.photoUrl(lightbox)} target="_blank" rel="noreferrer">Open full size</a>
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removePhoto(lightbox)}>
                  <Trash2 />Delete photo
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
