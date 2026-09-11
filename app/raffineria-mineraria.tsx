import { Redirect } from "expo-router";

/** Compatibilità vecchi link / bookmark → Miniera. */
export default function RaffineriaMinerariaRedirect() {
  return <Redirect href="/miniera" />;
}
