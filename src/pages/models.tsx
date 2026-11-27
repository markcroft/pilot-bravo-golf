import { ExternalLink, Plus } from "lucide-react";
import { MODELS } from "@shared/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ModelViewer } from "@/components/model-viewer";
import { NewVehicleDialog } from "@/components/new-vehicle-dialog";
import { KindIcon } from "@/components/model-icon";

export function ModelsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Model library</h1>
        <p className="text-sm text-muted-foreground">
          3D models available for vehicles. Drag to rotate, scroll or pinch to zoom, right-drag to pan.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {MODELS.map((m) => (
          <Card key={m.id} className="gap-0 overflow-hidden pt-0">
            <div className="h-64 border-b">
              <ModelViewer model={m} />
            </div>
            <CardHeader className="pt-5">
              <CardTitle className="flex items-center gap-2">
                <KindIcon kind={m.kind} className="size-4" />
                {m.name}
              </CardTitle>
              <CardDescription>{m.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-3 text-xs text-muted-foreground">
              Model by {m.attribution.author} · <Badge variant="outline">{m.attribution.license}</Badge>
            </CardContent>
            <CardFooter className="gap-2 pt-5">
              <NewVehicleDialog defaultModelId={m.id} trigger={<Button size="sm"><Plus />Use for a vehicle</Button>} />
              <Button size="sm" variant="ghost" asChild>
                <a href={m.attribution.url} target="_blank" rel="noreferrer"><ExternalLink />Source</a>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
