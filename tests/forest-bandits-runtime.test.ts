import assert from "node:assert/strict";
import test from "node:test";
import {
  applicaBanditiBoscoGiornalieri,
  possibileAssaltoBanditi,
  registraIngressoCastello
} from "../src/game/banditiBosco";
import type { Abitante, Edificio } from "../src/types";

const lavoratore = (id: number, lavoro: string, giorno = 1): Abitante => ({
  id, nome: "Abitante " + id, lavoro, salute: 100, razza: "Umano",
  ultimoIngressoBoscoGiorno: giorno,
  ultimoLavoroBosco: { giorno, minuti: 180 },
  inventario: [{ itemId: "monete", quantità: 12 }]
} as Abitante);
const edificio = (id: number, nome: string, ids: number[] = []): Edificio => ({
  id, nome, stato: "Operativo", abitantiAssegnati: ids,
  capacità: 20, occupazione: ids.length
} as Edificio);
const vittima = lavoratore(76, "Raccoglitore");
const bosco = edificio(51, "Bosco", [76]);

test("Banditi invisibili: la vittima reale genera una richiesta, mai un nuovo abitante", () => {
  // id 76, giorno 1, seed 1: evento deterministico con zero pattuglie.
  const risultato = applicaBanditiBoscoGiornalieri({
    abitanti: [vittima], edifici: [bosco], giorno: 1, mondoSeed: 1
  });
  assert.equal(risultato.guardaboschiAttivi, 0);
  assert.equal(risultato.eventi.length, 1);
  assert.equal(risultato.abitanti.length, 1);
  assert.equal(risultato.abitanti[0]!.richiestaRapinaBosco?.stato, "verso_castello");
  assert.ok(risultato.abitanti[0]!.inventario![0]!.quantità < 12);
  assert.equal(risultato.abitanti[0]!.ultimoControlloBanditiBoscoGiorno, 1);

  // Solo arrivo fisico al castello abilita l'udienza.
  const q = risultato.abitanti[0]!.richiestaRapinaBosco!;
  assert.equal(registraIngressoCastello(q, 76, "Castello", false), q);
  assert.equal(registraIngressoCastello(q, 76, "Bosco", true), q);
  assert.equal(registraIngressoCastello(q, 76, "Castello", true).stato, "pronta");

  const ripetuto = applicaBanditiBoscoGiornalieri({
    abitanti: risultato.abitanti, edifici: [bosco], giorno: 1, mondoSeed: 1
  });
  assert.equal(ripetuto.eventi.length, 0);
  assert.equal(ripetuto.abitanti, risultato.abitanti);
});

test("Guardaboschi verificati riducono davvero il rischio, non basta assumerli", () => {
  const guardie = Array.from({ length: 5 }, (_, i) => lavoratore(i + 30, "Guardaboschi"));
  const capanno = edificio(56, "Capanno del Guardaboschi", guardie.map(a => a.id));
  const protetto = applicaBanditiBoscoGiornalieri({
    abitanti: [vittima, ...guardie], edifici: [bosco, capanno], giorno: 1, mondoSeed: 1
  });
  assert.equal(protetto.guardaboschiAttivi, 5);
  assert.equal(protetto.eventi.length, 0);
  const inattive = guardie.map(a => ({ ...a, ultimoLavoroBosco: { giorno: 1, minuti: 0 } }));
  const nonProtetto = applicaBanditiBoscoGiornalieri({
    abitanti: [vittima, ...inattive], edifici: [bosco, capanno], giorno: 1, mondoSeed: 1
  });
  assert.equal(nonProtetto.guardaboschiAttivi, 0);
  assert.equal(nonProtetto.eventi.length, 1);
});

test("Niente assalti senza lavoro verificato o se già esiste un'udienza pendente", () => {
  const inTransito = { ...vittima, ultimoLavoroBosco: { giorno: 1, minuti: 0 } };
  assert.equal(applicaBanditiBoscoGiornalieri({
    abitanti: [inTransito], edifici: [bosco], giorno: 1
  }).eventi.length, 0);
  const attaccato = applicaBanditiBoscoGiornalieri({
    abitanti: [vittima], edifici: [bosco], giorno: 1
  }).abitanti[0]!;
  const altroGiorno = { ...attaccato, ultimoIngressoBoscoGiorno: 3,
    ultimoLavoroBosco: { giorno: 3, minuti: 200 } };
  assert.equal(applicaBanditiBoscoGiornalieri({
    abitanti: [altroGiorno], edifici: [bosco], giorno: 3
  }).eventi.length, 0);
});

test("Il codice della mappa conferma il Castello esclusivamente dopo fine commute", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync("app/mappa.tsx", "utf8");
  const pos = source.indexOf('if (purpose === "udienza_banditi")');
  assert.ok(pos > 0);
  assert.match(source.slice(pos, pos + 1200), /registraIngressoCastello\(/);
  assert.match(source, /pianificaCommuteVersoEdificioGlobaleDaCella\(/);
  assert.match(source, /udienzaCastelloEdificioId/);
});

test("La frequenza RNG rimane vicina al 3% e scende con i Guardaboschi", () => {
  let senzaGuardie = 0;
  let conCinque = 0;
  for (let id = 1; id <= 2000; id++) {
    const input = {
      mondoSeed: 1, giorno: 5, abitanteId: id,
      staLavorandoNelBosco: true, haGiaSubitoEventoOggi: false
    };
    if (possibileAssaltoBanditi({ ...input, guardaboschiAttivi: 0 })) senzaGuardie++;
    if (possibileAssaltoBanditi({ ...input, guardaboschiAttivi: 5 })) conCinque++;
  }
  assert.ok(senzaGuardie >= 25 && senzaGuardie <= 100, String(senzaGuardie));
  assert.ok(conCinque > 0 && conCinque < senzaGuardie, String(conCinque));
});
