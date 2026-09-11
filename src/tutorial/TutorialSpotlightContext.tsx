import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { SpotlightConfig, SpotlightTargetEntry, SpotlightTargetId } from "./spotlightTypes";

type TutorialSpotlightContextValue = {
  active: SpotlightConfig | null;
  showSpotlight: (config: SpotlightConfig) => void;
  dismissSpotlight: () => void;
  registerTarget: (id: SpotlightTargetId, entry: SpotlightTargetEntry) => void;
  unregisterTarget: (id: SpotlightTargetId) => void;
  getTarget: (id: SpotlightTargetId) => SpotlightTargetEntry | undefined;
};

const TutorialSpotlightContext = createContext<TutorialSpotlightContextValue | null>(null);

export function TutorialSpotlightProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<SpotlightConfig | null>(null);
  const targetsRef = useRef<Map<SpotlightTargetId, SpotlightTargetEntry>>(new Map());

  const showSpotlight = useCallback((config: SpotlightConfig) => {
    setActive(config);
  }, []);

  const dismissSpotlight = useCallback(() => {
    setActive(null);
  }, []);

  const registerTarget = useCallback((id: SpotlightTargetId, entry: SpotlightTargetEntry) => {
    targetsRef.current.set(id, entry);
  }, []);

  const unregisterTarget = useCallback((id: SpotlightTargetId) => {
    targetsRef.current.delete(id);
  }, []);

  const getTarget = useCallback((id: SpotlightTargetId) => targetsRef.current.get(id), []);

  const value = useMemo(
    () => ({
      active,
      showSpotlight,
      dismissSpotlight,
      registerTarget,
      unregisterTarget,
      getTarget
    }),
    [active, showSpotlight, dismissSpotlight, registerTarget, unregisterTarget, getTarget]
  );

  return (
    <TutorialSpotlightContext.Provider value={value}>{children}</TutorialSpotlightContext.Provider>
  );
}

export function useTutorialSpotlight(): TutorialSpotlightContextValue {
  const ctx = useContext(TutorialSpotlightContext);
  if (!ctx) {
    throw new Error("useTutorialSpotlight must be used within TutorialSpotlightProvider");
  }
  return ctx;
}

/** Variante sicura per componenti che possono vivere fuori dal provider (es. splash). */
export function useTutorialSpotlightOptional(): TutorialSpotlightContextValue | null {
  return useContext(TutorialSpotlightContext);
}
