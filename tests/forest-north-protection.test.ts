import assert from "node:assert/strict";
import test from "node:test";
import { cellaNellaForestaNord, footprintIntersecaForestaNord, RIGHE_FORESTA_NORD } from "../src/game/mappaForestaConfine";
import { isAcqua } from "../src/game/mappaGeometry";
import { isMareCell, isTerrenoAcqua } from "../src/game/riverGeneration";
import { puòPiazzareFootprintConCuscino } from "../src/game/mappaPiazzamentoFootprint";
import { footprintStrada2x2Valido } from "../src/game/stradaFootprint";
import { calcolaAnchorEdificioMultiCella, edificioRispettaCriteriPiazzamento, footprintTerreno2x2Valido } from "../src/game/mappaCostruzioneAnteprima";
import { ripristinaBoscoNord } from "../src/game/mappaBoscoNord";
import type { MappaRuntimeState } from "../src/game/mappaTypes";
const cols = 50, rows = 50;
const empty = (): MappaRuntimeState => ({edificiInMappa:{}, terrenoInMappa:{}, decorazioniInMappa:{}, residenzeMappa:{}});
test("il nord e' foresta e non mare su tutte le 50 colonne",()=>{
  assert.equal(RIGHE_FORESTA_NORD,6);
  for(let c=0;c<cols;c++){assert.equal(cellaNellaForestaNord(c,cols,rows),true);assert.equal(isAcqua(c,cols,rows),false);assert.equal(isMareCell(c,cols,rows),false);assert.equal(isTerrenoAcqua(c,{},cols,rows),false);}
  assert.equal(cellaNellaForestaNord(5*cols+49,cols,rows),true);
  assert.equal(cellaNellaForestaNord(6*cols+49,cols,rows),false);
  assert.equal(isMareCell(6*cols,cols,rows),true);
});
test("Bosco 5x5 come sede raccolta dentro la foresta senza duplicazioni",()=>{
  const state=ripristinaBoscoNord(empty(),cols,rows);
  const entry=Object.entries(state.edificiInMappa).find(([,e])=>e.nome==="Bosco" && !!e.footprint);
  assert.ok(entry);
  assert.equal(Math.floor(Number(entry[0])/cols),1);
  assert.equal(Object.keys(state.edificiInMappa).length,25);
  assert.equal(ripristinaBoscoNord(state,cols,rows),state);
});
test("il bosco legacy migra senza cancellare le case",()=>{
  const s=empty(), old=8*cols+20;
  s.edificiInMappa[old]={id:51,nome:"Bosco",emoji:"🌲",footprint:{w:5,h:5}};
  for(let r=0;r<5;r++)for(let c=0;c<5;c++){let k=old+r*cols+c;if(k!==old)s.edificiInMappa[k]={id:51,nome:"Bosco",emoji:"",footprintRef:old};}
  s.edificiInMappa[20]={id:777,nome:"Casa",emoji:"🏠"};
  const moved=ripristinaBoscoNord(s,cols,rows);
  assert.equal(moved.edificiInMappa[20]?.nome,"Casa");
  assert.equal(moved.edificiInMappa[old],undefined);
});
test("nessun edificio, strada o modifica terreno puo' intersecare il bosco",()=>{
  const a=5*cols+20,b=6*cols+20;
  assert.equal(footprintIntersecaForestaNord(a,2,2,cols,rows),true);
  assert.equal(footprintIntersecaForestaNord(b,2,2,cols,rows),false);
  assert.equal(puòPiazzareFootprintConCuscino(a,2,1,cols,rows,new Set(),new Set()),false);
  assert.equal(puòPiazzareFootprintConCuscino(b,2,1,cols,rows,new Set(),new Set()),true);
  assert.equal(edificioRispettaCriteriPiazzamento("Capanna",a,2,1,{},{},cols,rows),false);
  assert.equal(calcolaAnchorEdificioMultiCella(a,"Capanna",{},{},cols,rows).anchor,null);
  assert.equal(footprintStrada2x2Valido(a,cols,rows,{},{}),false);
  for(const kind of ["acqua","spiaggia","erba"] as const){assert.equal(footprintTerreno2x2Valido(kind,a,cols,rows,{},{}),false);}
});
