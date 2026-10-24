import React from "react";
import type { Abitante } from "../types";
import { AbitanteAvatarPreview } from "./AbitanteAvatarPreview";

/** Shared identity portrait for residents listed inside buildings.
 * Uses the same saved LPC appearance as the map/character sheet.
 * The existing preview displays a race fallback only for unsupported assets.
 */
export function BuildingResidentAvatar({ abitante }: { abitante: Abitante }) {
  return <AbitanteAvatarPreview abitante={abitante} size={32} faceOnly liftPx={0} />;
}
