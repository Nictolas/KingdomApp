import type { ReligioneConCulto } from "./luogoCulto";

export type RichiestaLuogoCultoInAttesa = {
  id: string;
  tipo: "luogo-culto";
  capoId: number;
  nomeCapo: string;
  religione: ReligioneConCulto;
  ricevutaMese: number;
  ricevutaAnno: number;
};

export type RichiestaInAttesa = RichiestaLuogoCultoInAttesa;

export function creaRichiestaLuogoCulto(
  capoId: number,
  nomeCapo: string,
  religione: ReligioneConCulto,
  mese: number,
  anno: number
): RichiestaLuogoCultoInAttesa {
  return {
    id: `luogo-culto-${capoId}-${anno}-${mese}`,
    tipo: "luogo-culto",
    capoId,
    nomeCapo,
    religione,
    ricevutaMese: mese,
    ricevutaAnno: anno
  };
}

export function haRichiestaLuogoCultoPendente(richieste: RichiestaInAttesa[]): boolean {
  return richieste.some((r) => r.tipo === "luogo-culto");
}
