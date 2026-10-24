/** Rotta legacy: politica religiosa, statistiche e fondazione sono ora nella
 * sezione unificata Religioni. Manteniamo i vecchi collegamenti funzionanti.
 */
import React from "react";
import { Redirect } from "expo-router";

export default function ReligioneLegacyRedirect() {
  return <Redirect href="/religioni" />;
}
