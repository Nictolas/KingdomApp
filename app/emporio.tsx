import React, { useEffect } from "react";
import { SafeAreaView, Text } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

/** Compatibilità `/emporio` → `/impresa/[id]`. */
export default function EmporioRedirect() {
  const router = useRouter();
  const { edifici } = useGameContext();

  useEffect(() => {
    const e = edifici.find((x) => x.nome === "Emporio");
    if (e) router.replace(`/impresa/${e.id}`);
  }, [edifici, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#050816", justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "rgba(203,213,245,0.7)", fontSize: 12 }}>Caricamento…</Text>
    </SafeAreaView>
  );
}
