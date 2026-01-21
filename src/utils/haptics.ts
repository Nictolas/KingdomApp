import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Safe haptic feedback wrapper that handles web platform gracefully
 */
export async function safeHapticSelection() {
  if (Platform.OS === "web") {
    // Haptics not available on web, silently ignore
    return;
  }
  try {
    await Haptics.selectionAsync();
  } catch (error) {
    // Silently ignore haptic errors
  }
}

export async function safeHapticNotification(type: Haptics.NotificationFeedbackType) {
  if (Platform.OS === "web") {
    // Haptics not available on web, silently ignore
    return;
  }
  try {
    await Haptics.notificationAsync(type);
  } catch (error) {
    // Silently ignore haptic errors
  }
}
