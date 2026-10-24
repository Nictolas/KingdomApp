import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generaRegnoIniziale } from "../src/game/generazionePartita.ts";
import {
  aspettoPerVisualizzazioneAbitante, creaCharacterAppearance, aspettoRenderizzabileAbitante
} from "../src/game/personaggioAspetto.ts";
import { canRenderCharacter } from "../src/character-system/registry.ts";
import { normalizeCharacterAppearance } from "../src/character-system/appearance.ts";

test("I vecchi ritratti con vestiti LPC assenti tornano visibili senza cambiare i salvataggi", () => {
  for (const [race, gender] of [["Nano","F"],["Nano","M"],["Umano","F"],["Orco","M"]] as const) {
    const base = creaCharacterAppearance(race, race === "Nano" ? "child" : "male");
    const broken = normalizeCharacterAppearance({
      ...base, upperOutfit: "nonexistent_shirt", lowerOutfit: "nonexistent_pants",
      outfit: "nonexistent_shirt", headwear: "nonexistent_hat"
    });
    assert.equal(canRenderCharacter(broken,"idle"),false);
    const stored = {
      coloreCapelli:"#000000",stileCapelli:"corti" as const,stileOcchi:"tondi" as const,
      colorePelle:"#e9b38f",vestiti:"viandante" as const,cappello:"nessuno" as const,
      characterAppearance:broken
    };
    const before=JSON.stringify(stored);
    const shown=aspettoPerVisualizzazioneAbitante({
      id: 112,razza:race,sesso:gender,eta:33,lavoro:"Disoccupato",aspetto:stored
    })?.characterAppearance;
    assert.ok(shown);
    assert.ok(canRenderCharacter(shown!,"idle"),race);
    assert.ok(canRenderCharacter(shown!,"walk"),race);
    assert.equal(shown?.race,broken.race);
    assert.equal(JSON.stringify(stored),before);
  }
});

test("Il rendering conserva gli sprite che sono già validi", () => {
  const base = normalizeCharacterAppearance({
    ...creaCharacterAppearance("Umano"),
    hairStyle:"none",upperOutfit:"none",lowerOutfit:"none",outfit:"none"
  });
  assert.ok(canRenderCharacter(base,"idle"));
  assert.equal(aspettoRenderizzabileAbitante(base),base);
});

test("Nessun residente iniziale visivamente invisibile in centinaia di partite", () => {
  for (const mode of ["creativa","avventura"] as const) {
    for(let i=0;i<80;i++) {
      const {abitanti}=generaRegnoIniziale(mode);
      for (const a of abitanti) {
        if (a.razza==="Golem") continue;
        const v=aspettoPerVisualizzazioneAbitante(a)?.characterAppearance;
        assert.ok(v, a.nome);
        assert.ok(canRenderCharacter(v!,"idle"),a.nome+" "+a.razza+" "+mode);
        assert.ok(canRenderCharacter(v!,"walk"),a.nome+" "+a.razza+" "+mode);
      }
    }
  }
});

test("La galleria Razze apre la scheda completa dell'abitante selezionato", () => {
  const page=readFileSync("app/razze/[razza].tsx","utf8");
  assert.match(page,/useState<number \| null>\(null\)/);
  assert.match(page,/accessibilityLabel=\{"Apri la scheda di " \+ abitante\.nome\}/);
  assert.match(page,/onPress=\{\(\) => setSelectedAbitanteId\(abitante\.id\)\}/);
  assert.match(page,/<AbitanteInfoModal/);
  assert.match(page,/visible=\{selectedAbitante !== null\}/);
  assert.match(page,/onClose=\{\(\) => setSelectedAbitanteId\(null\)\}/);
  assert.match(page,/abitante=\{selectedAbitante\}/);
  assert.match(page,/edifici=\{edifici\}/);
  assert.match(page,/selectedAbitante = abitanti\.find/);
  assert.equal((page.match(/<AbitanteInfoModal/g)||[]).length,1);
});

test("L'avatar non lascia mai un cerchio vuoto quando gli sprite sono incompatibili", () => {
  const source=readFileSync("src/ui/AbitanteAvatarPreview.tsx","utf8");
  assert.match(source,/canRenderCharacter\(aspetto\.characterAppearance, "idle"\)/);
  assert.match(source,/getEmojiRazza\(abitante\.razza \?\? "Umano"\)/);
});
