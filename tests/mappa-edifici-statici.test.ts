import assert from "node:assert/strict";
import test from "node:test";
import {
  BAR_EDIFICIO,
  CAPANNA,
  DECORAZIONI_EMOJI,
  DORMITORIO,
  GIACIMENTO,
  RAFFINERIA_MINERARIA,
  SERRA_2_EDIFICIO,
  SERRA_EDIFICIO,
  STRADA_OPZIONE,
  TRIBUNALE_EDIFICIO
} from "../src/game/mappaEdificiStatici";

test("static map building templates preserve ids, names and emoji", () => {
  const entries = [
    GIACIMENTO,
    RAFFINERIA_MINERARIA,
    STRADA_OPZIONE,
    DORMITORIO,
    BAR_EDIFICIO,
    TRIBUNALE_EDIFICIO,
    SERRA_EDIFICIO,
    SERRA_2_EDIFICIO,
    CAPANNA
  ];
  assert.deepEqual(
    entries.map(({ id, nome, emoji }) => ({ id, nome, emoji })),
    [
      { id: 0, nome: "Giacimento", emoji: "⛰️" },
      { id: 3, nome: "Raffineria Mineraria", emoji: "⚙️" },
      { id: -1, nome: "Strada", emoji: "🛤️" },
      { id: 14, nome: "Dormitorio", emoji: "🛏️" },
      { id: 17, nome: "Bar", emoji: "🍺" },
      { id: 12, nome: "Tribunale", emoji: "⚖️" },
      { id: 2, nome: "Serra", emoji: "🌱" },
      { id: 21, nome: "Serra", emoji: "🌱" },
      { id: 20, nome: "Capanna", emoji: "⛺" }
    ]
  );
});

test("procedural decoration emoji remain unchanged", () => {
  assert.deepEqual([...DECORAZIONI_EMOJI], ["🌳", "🌲", "🌴", "🌵", "🌋"]);
});
