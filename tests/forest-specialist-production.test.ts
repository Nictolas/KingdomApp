import assert from "node:assert/strict";
import test from "node:test";
import {
  applicaRaccoltaBoscoGiornaliera,
  PRODOTTI_PROFESSIONI_FORESTALI,
  BOTTINO_BOSCO
} from "../src/game/boscoRaccolta";
import type { Abitante, Edificio } from "../src/types";
import { OGGETTI_INVENTARIO } from "../src/game/inventario";

const bosco = {
  id: 51, nome: "Bosco", stato: "Operativo",
  capacità: 20, abitantiAssegnati: [], occupazione: 0
} as Edificio;
const mestieri = [
  [21, 54, "Cacciatore", "Capanna del Cacciatore"],
  [22, 55, "Taglialegna", "Campo dei Taglialegna"],
  [23, 57, "Erborista", "Erboristeria"],
  [24, 58, "Apicoltore", "Apiario"]
] as const;
function abitante(id: number, lavoro: string): Abitante {
  return {
    id, nome: "Lavoratore " + id, lavoro,
    casta: "Cittadino", razza: "Umano", personalità: "Paziente",
    competenza: 100, inventario: [{ itemId: "monete", quantità: 5 }],
    ultimoIngressoBoscoGiorno: 1,
    ultimoLavoroBosco: { giorno: 1, minuti: 360 }
  } as Abitante;
}
function edificio(id: number, nome: string, idLavoratore: number): Edificio {
  return {
    id, nome, stato: "Operativo", abitantiAssegnati: [idLavoratore],
    occupazione: 1, capacità: 4
  } as Edificio;
}

test("I prodotti dei mestieri del Bosco sono oggetti reali del catalogo", () => {
  for (const lista of Object.values(PRODOTTI_PROFESSIONI_FORESTALI)) {
    for (const id of lista ?? []) {
      assert.ok(BOTTINO_BOSCO.some(p => p.itemId === id), id);
      assert.ok(OGGETTI_INVENTARIO[id], id);
    }
  }
});

test("Cacciatore, Taglialegna, Erborista e Apicoltore producono dopo il lavoro vero", () => {
  const workers = mestieri.map(([id, , lavoro]) => abitante(id, lavoro));
  const sedi = mestieri.map(([id, eid, , nome]) => edificio(eid, nome, id));
  const risultato = applicaRaccoltaBoscoGiornaliera(workers, [bosco, ...sedi], 2, 1);
  assert.equal(risultato.bottini.length, 4);
  for (const [id, , lavoro] of mestieri) {
    const b = risultato.bottini.find(x => x.abitanteId === id);
    assert.ok(b, lavoro);
    assert.ok(b!.voci.every(x => PRODOTTI_PROFESSIONI_FORESTALI[lavoro]!.includes(x.itemId)));
    assert.ok(risultato.abitanti.find(a => a.id === id)?.ultimoRaccoltoBosco?.giorno === 1);
  }
  const duplicato = applicaRaccoltaBoscoGiornaliera(risultato.abitanti, [bosco, ...sedi], 2, 1);
  assert.equal(duplicato.bottini.length, 0);
});

test("Niente prodotti se manca la sede reale, se è chiusa o non ci sono ore di lavoro", () => {
  const ab = abitante(21, "Cacciatore");
  assert.equal(applicaRaccoltaBoscoGiornaliera([ab], [bosco], 2, 1).bottini.length, 0);
  assert.equal(applicaRaccoltaBoscoGiornaliera([ab], [
    bosco, { ...edificio(54, "Capanna del Cacciatore", 21), stato: "In costruzione" }
  ], 2, 1).bottini.length, 0);
  assert.equal(applicaRaccoltaBoscoGiornaliera([
    { ...ab, ultimoLavoroBosco: { giorno: 1, minuti: 0 } }
  ], [bosco, edificio(54, "Capanna del Cacciatore", 21)], 2, 1).bottini.length, 0);
});

test("Guardaboschi, Silvicoltori e Druidi non fabbricano oggetti dal nulla", () => {
  const workers = [abitante(25, "Guardaboschi"), abitante(26, "Silvicoltore"), abitante(27, "Druido")];
  const sedi = [
    edificio(56, "Capanno del Guardaboschi", 25),
    edificio(59, "Vivaio forestale", 26),
    edificio(60, "Cerchio dei Druidi", 27)
  ];
  const risultato = applicaRaccoltaBoscoGiornaliera(workers, [bosco, ...sedi], 2, 1);
  assert.equal(risultato.bottini.length, 0);
});
