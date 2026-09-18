import { Redirect } from "expo-router";

/** Alias verso la schermata Bilancio (Tesoro / crediti). */
export default function BilancioRedirect() {
  return <Redirect href="/crediti" />;
}
