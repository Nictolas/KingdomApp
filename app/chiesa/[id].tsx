import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ChiesaScreen } from "../../src/ui/ChiesaScreen";

export default function ChiesaByIdScreen() {
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const edificioId = Number(idStr);
  return <ChiesaScreen edificioId={edificioId} />;
}
