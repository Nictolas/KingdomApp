import React from "react";
import { SafeAreaView, Text } from "react-native";
import { useGameContext } from "../src/context/GameContext";
import { ImpresaScreen } from "../src/ui/ImpresaScreen";

export default function FucinaScreen() {
  const { edifici } = useGameContext();
  const fucina = edifici.find((e) => e.nome === "Fucina");

  if (!fucina) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#050816", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#e5e7eb" }}>Fucina non presente</Text>
      </SafeAreaView>
    );
  }

  return <ImpresaScreen edificioId={fucina.id} nomeAtteso="Fucina" />;
}
