import { Dimensions } from "react-native";
import type { Camera } from "../camera/useCamera";
import { safeHapticSelection } from "../utils/haptics";

type UseZoomReturn = {
  handleZoomIn: () => Promise<void>;
  handleZoomOut: () => Promise<void>;
};

export function useZoom(camera: Camera): UseZoomReturn {
  const handleZoomIn = async () => {
    const { width, height } = Dimensions.get("window");
    camera.zoomIncrement(width / 2, height / 2, 0.2);
    await safeHapticSelection();
  };

  const handleZoomOut = async () => {
    const { width, height } = Dimensions.get("window");
    camera.zoomIncrement(width / 2, height / 2, -0.2);
    await safeHapticSelection();
  };

  return { handleZoomIn, handleZoomOut };
}
