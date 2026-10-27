import { Platform } from "react-native";
import MappaPhaserPreviewScreen from "./mappa-phaser-preview";
import { MappaScreen } from "./mappa";

// Usa la home già disponibile nell'export web: nessuna riscrittura URL
// del server statico, nessuna attivazione per il gameplay ordinario.
export default function Index() {
  const perf200 =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("perf") === "1" &&
    new URLSearchParams(window.location.search).get("residents") === "200";
  return perf200 ? <MappaPhaserPreviewScreen /> : <MappaScreen />;
}
