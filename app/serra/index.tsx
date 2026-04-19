import { Redirect } from "expo-router";

/** Compatibilità con link generici: apre la prima Serra (id 2). */
export default function SerraIndex() {
  return <Redirect href="/serra/2" />;
}
