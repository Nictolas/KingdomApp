import React from "react";
import type { Abitante } from "../types";
import { getCharacterAppearanceAbitante } from "../game/abitanteAspettoLpc";
import { CircularSpriteFrame } from "./CircularSpriteFrame";

export function AbitanteLpcAvatar({
  abitante,
  size = 56,
  animate = false
}: {
  abitante: Pick<Abitante, "aspetto" | "razza" | "eta" | "sesso">;
  size?: number;
  animate?: boolean;
}) {
  const appearance = getCharacterAppearanceAbitante(abitante);
  if (!appearance) return null;

  return (
    <CircularSpriteFrame
      appearance={appearance}
      size={size}
      animation={animate ? "idle" : "idle"}
      direction="down"
      animate={animate}
    />
  );
}
