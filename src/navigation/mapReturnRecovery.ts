/**
 * Il ritorno da una schermata edificio richiede un nuovo canvas Phaser.
 *
 * Su Safari/PWA il vecchio canvas può rimanere visibile ma perdere gli
 * eventi touch dopo il pop della route. Il loop orologio è indipendente,
 * perciò i soli reset del puntatore non garantiscono il recupero.
 * Questa segnalazione riguarda SOLO il renderer, non la partita salvata.
 */
let pendingMapRenderRecovery = false;

export function markBuildingExitForMapRecovery(): void {
  pendingMapRenderRecovery = true;
}

export function consumeBuildingExitForMapRecovery(): boolean {
  const needed = pendingMapRenderRecovery;
  pendingMapRenderRecovery = false;
  return needed;
}
