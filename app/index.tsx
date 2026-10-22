import { Redirect } from "expo-router";

/** Unica route che monta Phaser: /mappa.
 * La home / resta un alias, ma non crea una seconda istanza WebGL.
 */
export default function Index() {
  return <Redirect href="/mappa" />;
}

