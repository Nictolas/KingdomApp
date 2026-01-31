import React from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Character, Building, Point } from "../types";
import { formatGameTime } from "../hooks/useGameClock";
import { styles } from "./InfoModal.styles";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";

type InfoModalProps = {
  visible: boolean;
  selectedCharacter: Character | null;
  selectedBuilding: Building | null;
  selectedRiver: Point | null;
  isClockModalOpen: boolean;
  gameTime: { hours: number; minutes: number };
  clockDraftMinutes: number;
  setClockDraftMinutes: (fn: (m: number) => number) => void;
  setGameTimeBaseMinutes: (minutes: number) => void;
  gameTimeStartRef: React.MutableRefObject<number>;
  setIsClockModalOpen: (open: boolean) => void;
  characters: Character[];
  houseAssignments: Record<string, number[]>;
  assignedCharactersForHouse: (houseId: string) => number[];
  assignToHouse: (houseId: string, charId: number | null) => void;
  isNight: boolean;
  onCallKing: () => void;
  onCallFarmer: () => void;
  onBuildBridge: () => void;
  onClose: () => void;
};

export function InfoModal({
  visible,
  selectedCharacter,
  selectedBuilding,
  selectedRiver,
  isClockModalOpen,
  gameTime,
  clockDraftMinutes,
  setClockDraftMinutes,
  setGameTimeBaseMinutes,
  gameTimeStartRef,
  setIsClockModalOpen,
  characters,
  houseAssignments,
  assignedCharactersForHouse,
  assignToHouse,
  isNight,
  onCallKing,
  onCallFarmer,
  onBuildBridge,
  onClose
}: InfoModalProps) {
  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]} onPress={onClose}>
        <Pressable style={[styles.modalCard, isDesktop && modalContentFullscreen]} onPress={() => undefined}>
          {isClockModalOpen && (
            <>
              <Text style={styles.modalTitle}>🕐 Imposta orario</Text>
              <Text style={styles.modalSub}>Ora attuale: {formatGameTime(gameTime.hours, gameTime.minutes)}</Text>
              <Text style={styles.modalSub}>
                Nuova ora: {formatGameTime(Math.floor(clockDraftMinutes / 60) % 24, clockDraftMinutes % 60)}
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <Pressable style={styles.btn} onPress={() => setClockDraftMinutes((m) => (m + 24 * 60 - 60) % (24 * 60))}>
                  <Text style={styles.btnText}>−1h</Text>
                </Pressable>
                <Pressable style={styles.btn} onPress={() => setClockDraftMinutes((m) => (m + 60) % (24 * 60))}>
                  <Text style={styles.btnText}>＋1h</Text>
                </Pressable>
                <Pressable style={styles.btn} onPress={() => setClockDraftMinutes((m) => (m + 24 * 60 - 15) % (24 * 60))}>
                  <Text style={styles.btnText}>−15m</Text>
                </Pressable>
                <Pressable style={styles.btn} onPress={() => setClockDraftMinutes((m) => (m + 15) % (24 * 60))}>
                  <Text style={styles.btnText}>＋15m</Text>
                </Pressable>
              </View>
              <Pressable
                style={[styles.btnPrimary, { marginTop: 12 }]}
                onPress={() => {
                  setGameTimeBaseMinutes(clockDraftMinutes);
                  gameTimeStartRef.current = Date.now();
                  setIsClockModalOpen(false);
                }}
              >
                <Text style={styles.btnTextPrimary}>Applica</Text>
              </Pressable>
            </>
          )}

          {selectedCharacter && (
            <>
              <Text style={styles.modalTitle}>
                {selectedCharacter.emoji} {selectedCharacter.name}
              </Text>
              <Text style={styles.modalSub}>Professione: {selectedCharacter.profession}</Text>
              <Text style={styles.modalSub}>Età: {selectedCharacter.age} anni</Text>
              <Text style={styles.modalSub}>
                Posizione: ({Math.round(selectedCharacter.x)}, {Math.round(selectedCharacter.y)})
              </Text>
            </>
          )}

          {selectedBuilding && (
            <>
              <Text style={styles.modalTitle}>
                {selectedBuilding.emoji} {selectedBuilding.name}
              </Text>
              <Text style={styles.modalSub}>{selectedBuilding.description}</Text>

              {selectedBuilding.type === "castle" && (
                <>
                  <Text style={styles.modalHint}>Premi per chiamare il Re.</Text>
                  <Pressable style={[styles.btnPrimary, { marginTop: 12 }]} onPress={onCallKing}>
                    <Text style={styles.btnTextPrimary}>Chiama Re</Text>
                  </Pressable>
                </>
              )}
              {selectedBuilding.type === "farm" && (
                <>
                  <Text style={styles.modalHint}>Premi per chiamare il Contadino.</Text>
                  <Pressable style={[styles.btnPrimary, { marginTop: 12 }]} onPress={onCallFarmer}>
                    <Text style={styles.btnTextPrimary}>Chiama Contadino</Text>
                  </Pressable>
                </>
              )}
              {selectedBuilding.type === "house" && (
                <>
                  <Text style={styles.modalHint}>Assegna un abitante: dalle 18:00 alle 6:00 rientra in casa.</Text>
                  <Text style={styles.modalSub}>
                    Abitanti attuali ({assignedCharactersForHouse(selectedBuilding.id).length}/2):{" "}
                    {assignedCharactersForHouse(selectedBuilding.id).length === 0
                      ? "Nessuno"
                      : assignedCharactersForHouse(selectedBuilding.id)
                          .map((id) => {
                            const c = characters.find((x) => x.id === id);
                            return c ? `${c.emoji} ${c.name}` : "";
                          })
                          .filter(Boolean)
                          .join(", ")}
                  </Text>
                  <View style={{ marginTop: 8, gap: 8 }}>
                    {assignedCharactersForHouse(selectedBuilding.id).length > 0 && (
                      <Pressable style={styles.btn} onPress={() => assignToHouse(selectedBuilding.id, null)}>
                        <Text style={styles.btnText}>Rimuovi tutti</Text>
                      </Pressable>
                    )}
                    {characters.map((c) => {
                      const assigned = assignedCharactersForHouse(selectedBuilding.id);
                      const isAssigned = assigned.includes(c.id);
                      const canAssign = assigned.length < 2;
                      return (
                        <Pressable
                          key={`assign-${selectedBuilding.id}-${c.id}`}
                          style={[styles.btn, isAssigned && styles.btnActive]}
                          onPress={() => assignToHouse(selectedBuilding.id, isAssigned ? null : c.id)}
                          disabled={!isAssigned && !canAssign}
                        >
                          <Text style={styles.btnText}>
                            {isAssigned ? "✓ " : ""}
                            {c.emoji} {c.name} {c.profession}
                            {!isAssigned && !canAssign ? " (Casa piena)" : ""}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.modalHint}>Stato notte: {isNight ? "NOTTE (rientrano)" : "GIORNO (escono)"}</Text>
                </>
              )}
            </>
          )}

          {selectedRiver && (
            <>
              <Text style={styles.modalTitle}>💧 Fiume</Text>
              <Text style={styles.modalSub}>
                Casella: ({selectedRiver.x}, {selectedRiver.y})
              </Text>
              <Text style={styles.modalHint}>Costruisci un ponte per permettere il passaggio (nessuno può entrare nel fiume senza ponte).</Text>
              <Pressable style={[styles.btnWarn, { marginTop: 12 }]} onPress={onBuildBridge}>
                <Text style={styles.btnTextPrimary}>Costruisci ponte</Text>
              </Pressable>
            </>
          )}

          <Pressable style={[styles.btnPrimary, { marginTop: 12 }]} onPress={onClose}>
            <Text style={styles.btnTextPrimary}>Chiudi</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
