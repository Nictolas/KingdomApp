import React from "react";
import { StyleSheet, View } from "react-native";
import type { AspettoPersonaggio, RazzaGiocatore } from "../game/personaggioAspetto";
import { COLORI_VESTITI } from "../game/personaggioAspetto";

export function PixelAvatarPreview({ razza, aspetto }: { razza: RazzaGiocatore; aspetto: AspettoPersonaggio }) {
  const clothes = COLORI_VESTITI[aspetto.vestiti];
  const pointed = razza === "Elfo";
  const beard = razza === "Nano";
  return (
    <View style={styles.frame} accessibilityLabel="Anteprima personaggio pixel art">
      <View style={[styles.shadow]} />
      <View style={[styles.leg, styles.legLeft]} />
      <View style={[styles.leg, styles.legRight]} />
      <View style={[styles.body, { backgroundColor: clothes.body }]} />
      <View style={[styles.belt, { backgroundColor: clothes.accent }]} />
      {pointed && <><View style={[styles.ear, styles.earLeft, { backgroundColor: aspetto.colorePelle }]} /><View style={[styles.ear, styles.earRight, { backgroundColor: aspetto.colorePelle }]} /></>}
      <View style={[styles.head, { backgroundColor: aspetto.colorePelle }]}>
        <View style={[styles.eye, styles.eyeLeft, aspetto.stileOcchi === "determinati" && styles.eyeAngled]} />
        <View style={[styles.eye, styles.eyeRight, aspetto.stileOcchi === "determinati" && styles.eyeAngled]} />
        {aspetto.stileOcchi === "allegri" && <View style={styles.smile} />}
      </View>
      <View style={[styles.hair, { backgroundColor: aspetto.coloreCapelli }, aspetto.stileCapelli === "lunghi" && styles.hairLong, aspetto.stileCapelli === "trecce" && styles.hairBraids]} />
      {aspetto.stileCapelli === "spettinati" && <View style={[styles.hairSpike, { backgroundColor: aspetto.coloreCapelli }]} />}
      {beard && <View style={[styles.beard, { backgroundColor: aspetto.coloreCapelli }]} />}
      {aspetto.cappello !== "nessuno" && (
        <View style={[styles.hat, aspetto.cappello === "cappuccio" && styles.hood, aspetto.cappello === "corona" && styles.crown]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 128, height: 144, position: "relative", backgroundColor: "#243447", borderWidth: 4, borderColor: "#0b1220", overflow: "hidden" },
  shadow: { position: "absolute", width: 64, height: 12, left: 32, bottom: 8, backgroundColor: "#111827", opacity: 0.65 },
  leg: { position: "absolute", width: 20, height: 28, bottom: 18, backgroundColor: "#3b271d", borderWidth: 4, borderColor: "#1c1511" },
  legLeft: { left: 37 }, legRight: { right: 37 },
  body: { position: "absolute", width: 66, height: 55, left: 31, bottom: 40, borderWidth: 5, borderColor: "#1c1511" },
  belt: { position: "absolute", width: 66, height: 9, left: 31, bottom: 57 },
  head: { position: "absolute", width: 72, height: 62, left: 28, top: 25, borderWidth: 5, borderColor: "#2a1b16" },
  ear: { position: "absolute", width: 18, height: 13, top: 49, borderWidth: 4, borderColor: "#2a1b16" },
  earLeft: { left: 14, transform: [{ rotate: "-18deg" }] }, earRight: { right: 14, transform: [{ rotate: "18deg" }] },
  eye: { position: "absolute", width: 8, height: 13, top: 27, backgroundColor: "#172033" },
  eyeLeft: { left: 16 }, eyeRight: { right: 16 }, eyeAngled: { height: 8, transform: [{ rotate: "12deg" }] },
  smile: { position: "absolute", width: 18, height: 5, left: 22, bottom: 8, backgroundColor: "#9b4f42" },
  hair: { position: "absolute", width: 76, height: 29, left: 26, top: 20, backgroundColor: "#6b3f24", borderWidth: 5, borderColor: "#2a1b16" },
  hairLong: { height: 57 }, hairBraids: { width: 88, left: 20, height: 48 },
  hairSpike: { position: "absolute", width: 22, height: 22, left: 52, top: 10, transform: [{ rotate: "45deg" }] },
  beard: { position: "absolute", width: 44, height: 25, left: 42, top: 68, borderWidth: 4, borderColor: "#2a1b16" },
  hat: { position: "absolute", width: 78, height: 24, left: 25, top: 7, backgroundColor: "#315c3b", borderWidth: 5, borderColor: "#1b2c21" },
  hood: { height: 44, borderRadius: 20 },
  crown: { width: 62, left: 33, height: 27, backgroundColor: "#e4b84c", borderColor: "#6e4c16" }
});
