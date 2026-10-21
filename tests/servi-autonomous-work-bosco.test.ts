import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { sediCercaLavoroDisoccupatoInOrdine, cercaPercorsoLavoroDisoccupato,
  trovaCellaPortaEdificio, pianificaCommuteMattina } from "../src/game/commutePathsMappa";
import { assumiCittadinoDisoccupatoInEdificio, edificioAccettaDisoccupatoCittadino,
  getServiDellaGlebaAssegnabili } from "../src/game/edificiLavoro";
import { assumiDisoccupatoNelBosco } from "../src/game/boscoRaccolta";
import type { Abitante, Edificio } from "../src/types";
const servo = { id:77, nome:"Marco Colombo", casta:"Servo della gleba", lavoro:"Disoccupato",
  razza:"Umano", competenza:80, inventario:[] } as Abitante;
const bosco = { id:51, nome:"Bosco", stato:"Operativo", capacità:20,
  abitantiAssegnati:[], occupazione:0 } as unknown as Edificio;
const bar = { id:17, nome:"Bar", stato:"Operativo", categoriaEconomica:"Impresa", tipo:"Svago",
  capacità:4, occupazione:0, abitantiAssegnati:[] } as unknown as Edificio;
const cols=50,rows=50,from=15*cols+22,anchor=cols+20;
const map={ [anchor]:{id:51,nome:"Bosco",footprint:{w:5,h:5}},
  [12*cols+25]:{id:17,nome:"Bar",footprint:{w:2,h:2}} };
const walkable=(i:number)=>i>=6*cols&&i<cols*rows&&
  !(Math.floor(i/cols)>=12&&Math.floor(i/cols)<=13&&i%cols>=25&&i%cols<=26);
test("Servo disoccupato cerca e ottiene un lavoro ordinario",()=>{
  assert.equal(edificioAccettaDisoccupatoCittadino(servo,bar,[servo]),true);
  const hired=assumiCittadinoDisoccupatoInEdificio([servo],[bar],servo.id,bar.id);
  assert.equal(hired.ok,true);assert.equal(hired.abitanti[0]?.lavoro,"Barista");
  assert.deepEqual(hired.edifici[0]?.abitantiAssegnati,[77]);
  assert.equal(assumiCittadinoDisoccupatoInEdificio(hired.abitanti,hired.edifici,77,17).ok,false);
});
test("Servo può essere assegnato manualmente solo se disoccupato",()=>{
  assert.deepEqual(getServiDellaGlebaAssegnabili([servo],[bar]).map(x=>x.id),[77]);
  assert.equal(getServiDellaGlebaAssegnabili([{...servo,lavoro:"Barista"}],[bar]).length,0);
  assert.equal(getServiDellaGlebaAssegnabili([{...servo,lavoro:"Raccoglitore"}],[bar]).length,0);
});
test("Prima lavori ordinari raggiungibili, quindi Bosco",()=>{
  const sedi=sediCercaLavoroDisoccupatoInOrdine(servo,[bosco,bar],[servo]);
  assert.equal(sedi[0]?.id,bar.id);assert.equal(sedi.at(-1)?.id,bosco.id);
  assert.equal(cercaPercorsoLavoroDisoccupato(servo,from,[bar,bosco],map,cols,rows,walkable)?.edificioId,17);
  const wood=cercaPercorsoLavoroDisoccupato(servo,from,[bosco],map,cols,rows,walkable);
  assert.equal(wood?.edificioId,51);assert.equal(wood?.path.at(-1),6*cols+22);
  assert.equal(pianificaCommuteMattina(servo,from,from,[bosco],map,cols,rows,walkable,540).purpose,"cerca_lavoro");
  const hired=assumiDisoccupatoNelBosco([servo],[bosco],77);
  assert.equal(hired.ok,true);assert.equal(hired.abitanti[0]?.lavoro,"Raccoglitore");
});
test("Se la porta centrale del Bosco è bloccata usa quella laterale",()=>{
  assert.equal(trovaCellaPortaEdificio(anchor,map,cols,rows,i=>walkable(i)&&i!==6*cols+22),6*cols+21);
});
test("Mappa usa ricerca autonoma per entrambe le caste",()=>{
  const source=readFileSync(new URL("../app/mappa.tsx",import.meta.url),"utf8");
  assert.match(source,/casta === "Servo della gleba"/);
  assert.match(source,/cercaPercorsoLavoroDisoccupato\(/);
});