export type AperturaResidenzaPending =
  | { tipo: "anchor"; anchor: number }
  | { tipo: "abitante"; abitanteId: number };

let pending: AperturaResidenzaPending | null = null;

export function impostaAperturaResidenzaAnchor(anchor: number): void {
  pending = { tipo: "anchor", anchor };
}

export function impostaAperturaResidenzaPerAbitante(abitanteId: number): void {
  pending = { tipo: "abitante", abitanteId };
}

export function getAperturaResidenzaPending(): AperturaResidenzaPending | null {
  return pending;
}

export function azzeraAperturaResidenzaPending(): void {
  pending = null;
}
