import { useCallback, useEffect, useRef } from "react";
import type { View } from "react-native";
import { useTutorialSpotlightOptional } from "./TutorialSpotlightContext";
import type { SpotlightTargetId } from "./spotlightTypes";

type Options = {
  /** Porta il controllo in vista quando lo spotlight diventa attivo su questo id. */
  ensureVisible?: () => void;
  /** Azione da eseguire quando il giocatore tocca il buco (equivalente al tap sul target). */
  onPress?: () => void;
};

/**
 * Registra un elemento UI come target spotlight ancorato (measureInWindow).
 * Restituisce il ref da attaccare al View da evidenziare.
 */
export function useSpotlightTarget(id: SpotlightTargetId, options?: Options) {
  const spotlight = useTutorialSpotlightOptional();
  const nodeRef = useRef<View | null>(null);
  const ensureVisibleRef = useRef(options?.ensureVisible);
  const onPressRef = useRef(options?.onPress);
  ensureVisibleRef.current = options?.ensureVisible;
  onPressRef.current = options?.onPress;

  const setRef = useCallback((node: View | null) => {
    nodeRef.current = node;
  }, []);

  useEffect(() => {
    if (!spotlight) return;
    const { registerTarget, unregisterTarget } = spotlight;
    registerTarget(id, {
      getNode: () => nodeRef.current,
      ensureVisible: () => ensureVisibleRef.current?.(),
      onPress: () => onPressRef.current?.()
    });
    return () => unregisterTarget(id);
    // Non dipendere da `spotlight` intero: cambia a ogni `active` e faceva unregister/re-register in corsa.
  }, [id, spotlight?.registerTarget, spotlight?.unregisterTarget]);

  return setRef;
}
