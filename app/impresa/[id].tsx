import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ImpresaScreen } from "../../src/ui/ImpresaScreen";

export default function ImpresaByIdScreen() {
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  return <ImpresaScreen edificioId={Number(idStr)} />;
}
