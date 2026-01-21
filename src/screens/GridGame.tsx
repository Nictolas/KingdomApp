import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { useCamera } from "../camera/useCamera";
import { GridRenderer } from "../components/GridRenderer";
import { GRID_SIZE, CELL_SIZE } from "../constants";

export default function GridGame() {
  const gridPixelSize = useMemo(() => {
    const size = GRID_SIZE * CELL_SIZE;
    return { w: size, h: size };
  }, []);

  const camera = useCamera({
    gridWidth: gridPixelSize.w,
    gridHeight: gridPixelSize.h
  });

  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  return (
    <View
      style={styles.container}
      onTouchStart={camera.onTouchStart}
      onTouchMove={camera.onTouchMove}
      onTouchEnd={camera.onTouchEnd}
      onMouseDown={camera.handleMouseDown}
      onMouseMove={camera.handleMouseMove}
      onMouseUp={camera.handleMouseUp}
    >
      <View
        style={[
          styles.gridContainer,
          {
            width: gridPixelSize.w,
            height: gridPixelSize.h,
            transform: [
              { translateX: camera.offset.x },
              { translateY: camera.offset.y }
            ]
          }
        ]}
      >
        <GridRenderer offset={{ x: 0, y: 0 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden"
  },
  gridContainer: {
    position: "absolute"
  }
});
