import React from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import type { Character } from "../types";
import { CELL_SIZE } from "../constants";

type CharacterRendererProps = {
  characters: Character[];
  onPress: (character: Character) => void;
};

export function CharacterRenderer({ characters, onPress }: CharacterRendererProps) {
  return (
    <>
      {characters.map((char) => {
        const left = char.x * CELL_SIZE;
        const top = char.y * CELL_SIZE;

        return (
          <Pressable
            key={`char-${char.id}`}
            onPress={() => onPress(char)}
            style={[
              styles.character,
              {
                left,
                top
              }
            ]}
          >
            <Text style={styles.emoji}>{char.emoji}</Text>
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
    justifyContent: "center"
  },
  emoji: {
    fontSize: 24
  }
});
