import assert from "node:assert/strict";
import test from "node:test";

import { EDIFICIO_TO_ROUTE } from "../src/game/mappaEdificioRoutes.ts";

test("la tabella route della mappa mantiene esattamente i mapping correnti", () => {
  assert.deepEqual(EDIFICIO_TO_ROUTE, {
    "Centro di Comando": "/amministrazione",
    "Serra": "/serra",
    "Centrale Energetica": "/centrale-energetica",
    "Raffineria Mineraria": "/raffineria-mineraria",
    "Impianto di Riciclo": "/impianto-riciclo",
    "Baracca": "/residenze",
    "Capanna": "/residenze",
    "Dormitorio": "/residenze",
    "Scuola": "/scuola",
    "Asilo": "/scuola",
    "Scuola Elementare": "/scuola",
    "Scuola Superiore": "/scuola",
    "Università": "/scuola",
    "Ospedale": "/ospedale",
    "Centrale": "/centrale",
    "Tribunale": "/tribunale",
    "Ufficio Immigrazione": "/immigrazione",
    "Ufficio Edile": "/ufficio-edile",
    "Mercato": "/mercato",
    "Dissalatore": "/dissalatore",
    "Laboratorio di Ricerca": "/laboratorio",
    "Bar": "/bar",
    "Mensa Pubblica": "/mensa",
    "Caserma": "/caserma",
    "Carcere": "/carcere",
    "Spazioporto": "/spazioporto"
  });
});

test("la mappa conserva i routing volutamente specifici rispetto alla schermata edifici", () => {
  assert.equal(EDIFICIO_TO_ROUTE["Centro di Comando"], "/amministrazione");
  assert.equal(EDIFICIO_TO_ROUTE["Serra"], "/serra");
  assert.equal(EDIFICIO_TO_ROUTE["Dormitorio"], "/residenze");
});
