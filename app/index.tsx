import { Platform } from "react-native";
import MappaPhaserPreviewScreen from "./mappa-phaser-preview";
import { MappaScreen } from "./mappa";
import { parsePhaserBenchmarkResidentCount } from "../src/phaser/adapters/phaserResidentsBenchmarkFixture";

// Usa la home già disponibile nell'export web: nessuna riscrittura URL
// del server statico, nessuna attivazione per il gameplay ordinario.
export default function Index() {
  const benchmarkCount =
    Platform.OS === "web" && typeof window !== "undefined"
      ? parsePhaserBenchmarkResidentCount(window.location.search)
      : null;
  return benchmarkCount != null ? <MappaPhaserPreviewScreen /> : <MappaScreen />;
}
