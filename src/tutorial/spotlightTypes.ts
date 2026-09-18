export type SpotlightTargetId = string;

export type SpotlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SpotlightConfig = {
  /** Id del target registrato (es. "mappa.costruisci"). */
  targetId: SpotlightTargetId;
  /** Padding aggiunto al raggio calcolato dal bounding box del target. */
  padding?: number;
  /** Se impostato, forza il raggio del cerchio (ignora max(w,h)/2 + padding). */
  radius?: number;
  /** Rect di fallback se il target non è ancora misurabile. */
  fallbackRect?: SpotlightRect;
};

export type SpotlightTargetEntry = {
  getNode: () => import("react-native").View | null;
  /** Opzionale: porta il target in vista (es. scroll della bottom bar). */
  ensureVisible?: () => void;
  /** Invocato quando il giocatore tocca il buco dello spotlight. */
  onPress?: () => void;
};

export const SPOTLIGHT_TARGET_IDS = {
  MAPPA_COSTRUISCI: "mappa.costruisci",
  MAPPA_PONTE: "mappa.ponte"
} as const;
