import React from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { timoreAbitante } from "../src/game/statoSociale";
export default function TimoreScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();
  const vivi = abitanti.filter(a => a.id !== 1 && a.razza !== "Golem");
  const media = vivi.length ? Math.round(vivi.reduce((s,a) => s + timoreAbitante(a),0)/vivi.length) : 0;
  return <SafeAreaView style={styles.root}>
    <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.title}>← Timore del Re e delle Guardie</Text></Pressable>
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.value}>{media}%</Text>
      <Text style={styles.label}>Timore medio dei cittadini ({vivi.length} abitanti)</Text>
      <Text style={styles.desc}>Il Timore riduce la propensione alle ribellioni, ma non aumenta la Soddisfazione.</Text>
      {vivi.map(a => <View key={a.id} style={styles.row}><Text style={styles.name}>{a.nome}</Text><Text style={styles.score}>{timoreAbitante(a)}%</Text></View>)}
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:"#050816"},back:{padding:18,backgroundColor:"#0f172a"},
  title:{color:"#f8fafc",fontWeight:"800",fontSize:18},body:{padding:18,paddingBottom:48,gap:12},
  value:{color:"#f8fafc",fontSize:34,fontWeight:"900"},label:{color:"#cbd5e1",fontSize:14},
  desc:{color:"#94a3b8",lineHeight:21,marginBottom:12},
  row:{backgroundColor:"#0f172a",padding:13,borderRadius:12,flexDirection:"row",justifyContent:"space-between",gap:10},
  name:{color:"#f8fafc",flex:1},score:{color:"#93c5fd",fontWeight:"700"}
});
