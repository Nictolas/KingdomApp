import React, { useEffect } from "react";
import { SafeAreaView, Text } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../../src/context/GameContext";

/** Compatibilità con link a `/bar`: reindirizza al primo Bar dell’elenco edifici. */
export default function BarIndexRedirect() {
  const router = useRouter();
  const { edifici } = useGameContext();

  useEffect(() => {
    const bars = edifici.filter((e) => e.nome === "Bar").sort((a, b) => a.id - b.id);
    if (bars.length >= 1) {
      router.replace(`/bar/${bars[0].id}`);
    }
  }, [edifici, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#050816", justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "rgba(203,213,245,0.7)", fontSize: 12 }}>Caricamento…</Text>
    </SafeAreaView>
  );
}
