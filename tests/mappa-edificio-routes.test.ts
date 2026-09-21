import assert from "node:assert/strict";
import test from "node:test";

import { EDIFICIO_TO_ROUTE } from "../src/game/mappaEdificioRoutes.ts";

test("la tabella route della mappa mantiene esattamente i mapping correnti", () => {
  assert.deepEqual(EDIFICIO_TO_ROUTE, {
    Castello: "/castello",
    Zecca: "/zecca",
    Emporio: "/emporio",
    Porto: "/porto",
    Fucina: "/fucina",
    Serra: "/serra",
    Miniera: "/miniera",
    Bosco: "/bosco",
    "Impianto di Riciclo": "/impianto-riciclo",
    Baracca: "/residenze",
    Capanna: "/residenze",
    Dormitorio: "/residenze",
    Scuola: "/scuola",
    Asilo: "/scuola",
    "Scuola Elementare": "/scuola",
    "Scuola Superiore": "/scuola",
    Università: "/scuola",
    Ospedale: "/ospedale",
    Centrale: "/centrale",
    Tribunale: "/tribunale",
    "Ufficio Immigrazione": "/immigrazione",
    "Ufficio Edile": "/ufficio-edile",
    Mercato: "/mercato",
    Dissalatore: "/dissalatore",
    "Laboratorio di Ricerca": "/laboratorio",
    Bar: "/bar",
    "Mensa Pubblica": "/mensa",
    Caserma: "/caserma",
    Carcere: "/carcere"
  });
});

test("la mappa usa solo i nomi fantasy correnti per i routing rimossi dalla vecchia lore", () => {
  assert.equal(EDIFICIO_TO_ROUTE.Castello, "/castello");
  assert.equal(EDIFICIO_TO_ROUTE.Porto, "/porto");
  assert.equal(EDIFICIO_TO_ROUTE["Centro di Comando"], undefined);
  assert.equal(EDIFICIO_TO_ROUTE.Spazioporto, undefined);
  assert.equal(EDIFICIO_TO_ROUTE["Centrale Energetica"], undefined);
  assert.equal(EDIFICIO_TO_ROUTE["Raffineria Mineraria"], undefined);
});
