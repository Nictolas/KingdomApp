export type MappaCharacterVisibilityState = {
  inCommute: boolean;
  atWorkNow: boolean;
  atBarNow: boolean;
  atCultNow: boolean;
};

/**
 * Contratto condiviso tra renderer web Phaser e renderer React Native.
 *
 * Un personaggio in movimento resta sempre visibile. Quando invece ha concluso
 * il tragitto, scompare dalla mappa se si trova dentro lavoro, bar o culto.
 */
export function mapCharacterShouldBeVisible(state: MappaCharacterVisibilityState): boolean {
  if (state.inCommute) return true;
  return !(state.atWorkNow || state.atBarNow || state.atCultNow);
}
