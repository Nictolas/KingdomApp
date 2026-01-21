import { isRiver } from "../game/terrain";
import type { Point } from "../types";

type UseCellInteractionReturn = {
  handleCellPress: (x: number, y: number) => void;
};

type UseCellInteractionOptions = {
  buildMode: "light" | "bridge" | null;
  isBridge: (x: number, y: number) => boolean;
  buildLightFn: (x: number, y: number) => Promise<void>;
  buildBridgeAtFn: (x: number, y: number) => Promise<void>;
  selectRiver: (x: number, y: number, wasRecentlyDragging: () => boolean, isRiver: (x: number, y: number) => boolean, isBridge: (x: number, y: number) => boolean) => Promise<void>;
  wasRecentlyDragging: () => boolean;
};

export function useCellInteraction(options: UseCellInteractionOptions): UseCellInteractionReturn {
  const {
    buildMode,
    isBridge,
    buildLightFn,
    buildBridgeAtFn,
    selectRiver,
    wasRecentlyDragging
  } = options;

  const handleCellPress = (x: number, y: number) => {
    if (buildMode === "light") {
      buildLightFn(x, y);
    } else if (buildMode === "bridge") {
      const river = isRiver(x, y);
      const bridge = isBridge(x, y);
      if (river && !bridge) {
        buildBridgeAtFn(x, y);
      }
    } else {
      const river = isRiver(x, y);
      const bridge = isBridge(x, y);
      if (river && !bridge) {
        selectRiver(x, y, wasRecentlyDragging, isRiver, isBridge);
      }
    }
  };

  return { handleCellPress };
}
