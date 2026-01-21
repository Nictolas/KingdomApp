import React from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import type { Character } from "../types";
import { CELL_SIZE } from "../constants";

type CharacterRendererProps = {
  characters: Character[];
  onPress: (character: Character) => void;
  selectedCharacterId?: number | null;
};

export function CharacterRenderer({ characters, onPress, selectedCharacterId }: CharacterRendererProps) {
  return (
    <>
      {characters.map((char) => {
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
