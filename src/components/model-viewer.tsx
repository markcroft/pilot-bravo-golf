import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Bounds, ContactShadows, Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { MODEL_SIZE, type ModelDef } from "@shared/models";
import type { Finding } from "@shared/types";
import { REPAIRED_COLOR, SEVERITY_COLOR } from "@/lib/format";

export interface PickedPoint {
  position: [number, number, number];
  normal: [number, number, number];
}

export type ViewPreset = "iso" | "front" | "back" | "left" | "right" | "top" | "bottom";

interface Props {
  model: ModelDef;
  findings?: Finding[];
  selectedId?: string | null;
  placing?: boolean;
  pending?: PickedPoint | null;
  view?: { preset: ViewPreset; nonce: number };
  onPick?: (p: PickedPoint) => void;
  onSelect?: (id: string) => void;
  autoRotate?: boolean;
  interactive?: boolean;
  children?: ReactNode;
}

/** Loads a GLB and normalizes it: centered at the origin, longest side = MODEL_SIZE, resting on y=0. */
function NormalizedModel({ model, placing, onPick }: { model: ModelDef; placing?: boolean; onPick?: (p: PickedPoint) => void }) {
  const { scene } = useGLTF(model.file);
  const { object, offset, scale } = useMemo(() => {
    const object = scene.clone(true);
    if (model.rotation) object.rotation.set(...model.rotation);
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = MODEL_SIZE / Math.max(size.x, size.y, size.z);
    const offset = new THREE.Vector3(-center.x * scale, -box.min.y * scale, -center.z * scale);
    object.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return { object, offset, scale };
  }, [scene, model.rotation]);

  const [hover, setHover] = useState<THREE.Vector3 | null>(null);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!placing || !onPick) return;
    // Ignore clicks that were really orbit drags.
    if (e.delta > 6) return;
    e.stopPropagation();
    const n = e.face?.normal?.clone() ?? new THREE.Vector3(0, 1, 0);
    n.transformDirection(e.object.matrixWorld).normalize();
    onPick({ position: [e.point.x, e.point.y, e.point.z], normal: [n.x, n.y, n.z] });
  };

  return (
    <group>
      <group position={offset} scale={scale}>
        <primitive
          object={object}
          onClick={handleClick}
          onPointerMove={(e: ThreeEvent<PointerEvent>) => placing && setHover(e.point.clone())}
          onPointerOut={() => setHover(null)}
        />
      </group>
      {placing && hover && (
        <mesh position={hover} raycast={() => null}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthTest={false} />
        </mesh>
      )}
    </group>
  );
}

function Pin({
  position, normal, color, selected, label, onClick, pulse,
}: {
  position: [number, number, number];
  normal: [number, number, number];
  color: string;
  selected?: boolean;
  label?: string;
  pulse?: boolean;
  onClick?: () => void;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  // Lift the pin slightly off the surface along its normal so it never z-fights.
  const pos = useMemo(() => {
    const p = new THREE.Vector3(...position);
    return p.add(new THREE.Vector3(...normal).multiplyScalar(0.06));
  }, [position, normal]);
  const quat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal).normalize()),
    [normal],
  );

  useFrame(({ clock }) => {
    if (!ring.current) return;
    const s = selected || pulse ? 1 + 0.35 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 5)) : 1;
    ring.current.scale.setScalar(s);
  });

  const r = selected ? 0.16 : 0.12;
  return (
    <group position={pos}>
      <mesh
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = ""; }}
      >
        <sphereGeometry args={[r, 24, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={ring} quaternion={quat} raycast={() => null}>
        <ringGeometry args={[r * 1.35, r * 1.75, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {(hovered || selected) && label && (
        <Html center position={[0, r * 2.6, 0]} style={{ pointerEvents: "none" }} zIndexRange={[20, 0]}>
          <div className="rounded-md border bg-popover px-2 py-1 text-xs font-medium whitespace-nowrap text-popover-foreground shadow-md">
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

const PRESET_DIRS: Record<ViewPreset, [number, number, number]> = {
  iso: [1, 0.6, 1],
  front: [0, 0.15, 1],
  back: [0, 0.15, -1],
  left: [-1, 0.15, 0],
  right: [1, 0.15, 0],
  top: [0.001, 1, 0.001],
  bottom: [0.001, -1, 0.001],
};

/** Smoothly moves the camera to presets or to focus on the selected finding. */
function CameraRig({ view, focus }: { view?: Props["view"]; focus?: THREE.Vector3 | null }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null };
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const center = useMemo(() => new THREE.Vector3(0, MODEL_SIZE * 0.15, 0), []);

  useEffect(() => {
    if (!view) return;
    const dir = new THREE.Vector3(...PRESET_DIRS[view.preset]).normalize();
    goal.current = { pos: center.clone().add(dir.multiplyScalar(MODEL_SIZE * 1.45)), target: center.clone() };
  }, [view, center]);

  useEffect(() => {
    if (!focus || !controls) return;
    const offset = camera.position.clone().sub(controls.target);
    const dist = Math.min(offset.length(), MODEL_SIZE * 0.9);
    goal.current = { pos: focus.clone().add(offset.normalize().multiplyScalar(dist)), target: focus.clone() };
  }, [focus, camera, controls]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    const k = 1 - Math.pow(0.001, dt);
    camera.position.lerp(g.pos, k);
    controls.target.lerp(g.target, k);
    controls.update();
    if (camera.position.distanceTo(g.pos) < 0.01 && controls.target.distanceTo(g.target) < 0.01) goal.current = null;
  });

  // Any user interaction cancels an in-flight animation.
  useEffect(() => {
    if (!controls) return;
    const stop = () => { goal.current = null; };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  return null;
}

function Loader() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        Loading model… {Math.round(progress)}%
      </div>
    </div>
  );
}

export function ModelViewer({
  model, findings = [], selectedId, placing, pending, view, onPick, onSelect, autoRotate, interactive = true, children,
}: Props) {
  const focus = useMemo(() => {
    const f = findings.find((x) => x.id === selectedId);
    return f ? new THREE.Vector3(f.pos_x, f.pos_y, f.pos_z) : null;
  }, [findings, selectedId]);

  return (
    <div className={`relative h-full w-full bg-viewer ${placing ? "cursor-crosshair" : ""}`}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [MODEL_SIZE * 0.9, MODEL_SIZE * 0.6, MODEL_SIZE * 0.9], fov: 40, near: 0.05, far: 500 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <hemisphereLight args={["#ffffff", "#8a8f99", 1.6]} />
        <directionalLight position={[8, 14, 6]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} />
        <directionalLight position={[-8, 6, -6]} intensity={0.9} />
        <Suspense fallback={null}>
          <Bounds fit clip margin={1.15} maxDuration={0}>
            <NormalizedModel model={model} placing={placing} onPick={onPick} />
          </Bounds>
          {findings.map((f) => (
            <Pin
              key={f.id}
              position={[f.pos_x, f.pos_y, f.pos_z]}
              normal={[f.nrm_x, f.nrm_y, f.nrm_z]}
              color={f.status === "repaired" ? REPAIRED_COLOR : SEVERITY_COLOR[f.severity]}
              selected={f.id === selectedId}
              label={f.title}
              onClick={() => !placing && onSelect?.(f.id)}
            />
          ))}
          {pending && <Pin position={pending.position} normal={pending.normal} color="#a855f7" pulse label="New finding" />}
          <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={MODEL_SIZE * 2} blur={2.5} far={MODEL_SIZE} />
        </Suspense>
        <OrbitControls
          makeDefault
          enableDamping
          enabled={interactive}
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
          minDistance={1}
          maxDistance={MODEL_SIZE * 4}
          target={[0, MODEL_SIZE * 0.15, 0]}
        />
        <CameraRig view={view} focus={focus} />
      </Canvas>
      <Loader />
      {children}
    </div>
  );
}

export const preloadModel = (file: string) => useGLTF.preload(file);
