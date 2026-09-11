import React, { useEffect } from "react";
import { SafeAreaView, Text } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../../src/context/GameContext";

/** Compatibilità `/serra` → prima Serra come Impresa. */
export default function SerraIndex() {
  const router = useRouter();
  const { edifici } = useGameContext();

  useEffect(() => {
    const e = edifici.find((x) => x.nome === "Serra");
    if (e) router.replace(`/impresa/${e.id}`);
  }, [edifici, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#050816", justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "rgba(203,213,245,0.7)", fontSize: 12 }}>Caricamento…</Text>
    </SafeAreaView>
  );
}
