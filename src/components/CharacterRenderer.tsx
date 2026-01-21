import React from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import type { Character, Building } from "../types";
import { CELL_SIZE } from "../constants";
import { isInsideBuilding } from "../game/orcLogic";

type CharacterRendererProps = {
  characters: Character[];
  buildings: Building[];
  onPress: (character: Character) => void;
  selectedCharacterId?: number | null;
};

export function CharacterRenderer({ characters, buildings, onPress, selectedCharacterId }: CharacterRendererProps) {
  // Filtra i personaggi che sono dentro gli edifici (non devono essere visibili)
  const visibleCharacters = characters.filter(char => {
    // Le lapidi sono sempre visibili
    if (char.emoji === "🪦") return true;
    // I personaggi dentro gli edifici non sono visibili
    return !isInsideBuilding(char, buildings);
  });

  return (
    <>
      {visibleCharacters.map((char) => {
        const left = char.x * CELL_SIZE;
        const top = char.y * CELL_SIZE;
        const isSelected = selectedCharacterId === char.id;

        return (
          <Pressable
            key={`char-${char.id}`}
            onPress={() => onPress(char)}
            style={[
              styles.character,
              {
                left,
                top,
                borderWidth: isSelected ? 2 : 0,
                borderColor: "#ffeb3b"
              }
            ]}
            onStartShouldSetResponder={() => false}
          >
            <Text style={styles.emoji} selectable={false}>{char.emoji}</Text>
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  character: {
    position: "absolute",
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    WebkitUserSelect: "none",
    MozUserSelect: "none",
    msUserSelect: "none"
  },
  emoji: {
    fontSize: 24,
    userSelect: "none",
    WebkitUserSelect: "none"
  }
});
