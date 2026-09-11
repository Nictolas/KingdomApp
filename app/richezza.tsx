import { Redirect } from "expo-router";

/** Typo legacy: /richezza → /ricchezza */
export default function RichezzaRedirect() {
  return <Redirect href="/ricchezza" />;
}
