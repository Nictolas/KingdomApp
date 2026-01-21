import { Dimensions } from "react-native";
import * as Haptics from "expo-haptics";
import type { Camera } from "../camera/useCamera";

type UseZoomReturn = {
  handleZoomIn: () => Promise<void>;
  handleZoomOut: () => Promise<void>;
};

export function useZoom(camera: Camera): UseZoomReturn {
  const handleZoomIn = async () => {
    const { width, height } = Dimensions.get("window");
    camera.zoomIncrement(width / 2, height / 2, 0.2);
    await Haptics.selectionAsync();
  };

  const handleZoomOut = async () => {
    const { width, height } = Dimensions.get("window");
    camera.zoomIncrement(width / 2, height / 2, -0.2);
    await Haptics.selectionAsync();
  };

  return { handleZoomIn, handleZoomOut };
}
