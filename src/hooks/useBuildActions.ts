import type { Point, Bridge, Light, Placed } from "../types";
import { buildBridge, buildBridgeAt, buildLight } from "../game/actions";

type UseBuildActionsReturn = {
  buildBridgeFn: () => Promise<void>;
  buildBridgeAtFn: (x: number, y: number) => Promise<void>;
  buildLightFn: (x: number, y: number) => Promise<void>;
};

type UseBuildActionsOptions = {
  selectedRiver: Point | null;
  buildMode: "light" | "bridge" | null;
  bridges: Bridge[];
  trees: Placed[];
  mines: Placed[];
  lights: Light[];
  setBridges: React.Dispatch<React.SetStateAction<Bridge[]>>;
  setLights: React.Dispatch<React.SetStateAction<Light[]>>;
  setSelectedRiver: (value: Point | null) => void;
};

export function useBuildActions(options: UseBuildActionsOptions): UseBuildActionsReturn {
  const {
    selectedRiver,
    buildMode,
    trees,
    mines,
    lights,
    setBridges,
    setLights,
    setSelectedRiver
  } = options;

  const buildBridgeFn = buildBridge(selectedRiver, setBridges, setSelectedRiver);
  const buildBridgeAtFn = (x: number, y: number) => buildBridgeAt(x, y, setBridges)();
  const buildLightFn = (x: number, y: number) => buildLight(x, y, buildMode, trees, mines, lights, setLights)();

  return { buildBridgeFn, buildBridgeAtFn, buildLightFn };
}
