import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ImpresaScreen } from "../../src/ui/ImpresaScreen";

/** Compatibilità `/bar/[id]` → stessa scheda Impresa. */
export default function BarScreenById() {
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const edificioId = Number(idStr);
  return <ImpresaScreen edificioId={edificioId} nomeAtteso="Bar" />;
}
