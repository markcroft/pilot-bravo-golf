import type { VehicleKind } from "./types";

/**
 * Library of 3D models a vehicle can be mapped onto. Files live in /public/models
 * and are served as static assets by the Worker.
 *
 * Finding coordinates are stored in the model's *normalized* space (centered,
 * scaled so the longest side is MODEL_SIZE units, after `rotation` is applied),
 * so pins stay put regardless of the source file's native units.
 */
export const MODEL_SIZE = 10;

export interface ModelDef {
  id: string;
  name: string;
  kind: VehicleKind;
  description: string;
  file: string;
  /** Euler rotation (radians) applied before normalizing, to stand the model upright. */
  rotation?: [number, number, number];
  attribution: { author: string; license: string; url: string };
}

export const MODELS: ModelDef[] = [
  {
    id: "cesium-air",
    name: "Twin turboprop aircraft",
    kind: "aircraft",
    description: "High-wing twin-engine transport plane",
    file: "/models/cesium-air.glb",
    attribution: {
      author: "Cesium",
      license: "Apache-2.0 (CesiumJS sample data)",
      url: "https://github.com/CesiumGS/cesium/tree/main/Apps/SampleData/models/CesiumAir",
    },
  },
  {
    id: "ground-vehicle",
    name: "Armored utility vehicle",
    kind: "ground",
    description: "6x6 armored utility truck",
    file: "/models/ground-vehicle.glb",
    attribution: {
      author: "Cesium",
      license: "Apache-2.0 (CesiumJS sample data)",
      url: "https://github.com/CesiumGS/cesium/tree/main/Apps/SampleData/models/GroundVehicle",
    },
  },
  {
    id: "milk-truck",
    name: "Box truck",
    kind: "ground",
    description: "Medium-duty delivery truck",
    file: "/models/milk-truck.glb",
    attribution: {
      author: "Cesium",
      license: "CC-BY-4.0",
      url: "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMilkTruck",
    },
  },
  {
    id: "kenney-truck",
    name: "Pickup truck (low-poly)",
    kind: "ground",
    description: "Simplified pickup, fast to load on phones",
    file: "/models/kenney-truck.glb",
    attribution: {
      author: "Kenney",
      license: "CC0-1.0",
      url: "https://github.com/KenneyNL/Starter-Kit-Racing",
    },
  },
];

export const getModel = (id: string) => MODELS.find((m) => m.id === id) ?? MODELS[0];
