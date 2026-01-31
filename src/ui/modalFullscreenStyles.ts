/** Soglia larghezza (px) oltre cui considerare desktop: modal a schermo intero */
export const DESKTOP_MODAL_BREAKPOINT = 768;

/** Stili da applicare al contenuto del modal su desktop (tutto schermo) */
export const modalContentFullscreen = {
  flex: 1 as const,
  width: "100%" as const,
  height: "100%" as const,
  maxWidth: "100%" as const,
  maxHeight: "100%" as const,
  minWidth: "100%" as const,
  minHeight: "100%" as const,
  borderRadius: 0,
  margin: 0
};

/** Stili da applicare al backdrop del modal su desktop (nessun padding, contenuto pieno) */
export const modalBackdropFullscreen = {
  padding: 0,
  justifyContent: "center" as const,
  alignItems: "center" as const
};
