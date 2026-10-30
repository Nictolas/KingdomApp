// End-to-end browser smoke for the playable sector mode (not native device verification).
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium } from "playwright";
import { findStaticPreviewFile } from "./sector-preview-static-server.mjs";

const root=resolve(process.argv[2]||"dist");
const mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".woff2":"font/woff2"};
const server=createServer(async(req,res)=>{
 try {
 const pathname=decodeURIComponent(new URL(req.url||"/","http://localhost").pathname);
 const file=await findStaticPreviewFile(root,pathname);
 if(!file){res.writeHead(404);res.end("Not found");return;}
 res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream"});
 res.end(await readFile(file));
 } catch(e){res.writeHead(500);res.end("Error");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const port=server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 for(const [width,height] of [[390,844],[320,568]]){
 const page=await browser.newPage({viewport:{width,height}});
 const errors=[];
 page.on("pageerror",err=>errors.push(String(err)));
 try{
 await page.goto("http://127.0.0.1:"+port+"/",{waitUntil:"domcontentloaded"});
 await page.getByTestId("choose-sector-mode").waitFor({state:"visible",timeout:60000});
 assert.ok(await page.getByRole("button",{name:"Avventura"}).isVisible());
 assert.ok(await page.getByRole("button",{name:"Creativa"}).isVisible());
 await page.getByTestId("choose-sector-mode").click();
 await page.getByTestId("sector-game-grid").waitFor({state:"visible",timeout:40000});
 // Pause the autonomous clock while we verify image decoding on slower CI runners.
 await page.getByTestId("sector-game-pause").click();
 await page.waitForFunction(()=>{
   const grid=document.querySelector('[data-testid="sector-game-grid"]');
   if(!grid)return false;
   const terrain=grid.querySelectorAll('[data-testid="sector-terrain-tile"]');
   const residents=grid.querySelectorAll('[data-testid="sector-resident"]');
   const images=Array.from(grid.querySelectorAll('img'));
   const humans=grid.querySelectorAll('[data-testid="resident-human-lpc"]');
   return terrain.length===384 && residents.length===30 && humans.length===30 &&
     images.length>=414 && images.every(img=>img.complete&&img.naturalWidth>0) &&
     Array.from(humans).every(h=>h.querySelectorAll("img").length>=2) &&
     !grid.querySelector('[data-testid="sector-resident-atlas-image"]');
 },undefined,{timeout:30000});
 await mkdir("sector-screenshots",{recursive:true});
 await page.screenshot({path:`sector-screenshots/playable-human-lpc-${width}x${height}.png`});
 const rec=await page.evaluate(()=>{
  const rect=id=>{const r=document.querySelector('[data-testid="'+id+'"]')?.getBoundingClientRect();
     if(!r)throw Error(id+" missing");
     return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
  return {grid:rect("sector-game-grid"),root:rect("sector-game-root"),resources:rect("sector-game-resources"),navigation:rect("sector-game-navigation")};
 });
 assert.ok(Math.abs(rec.grid.w/16-rec.grid.h/24)<.2,"Cells are not square");
 assert.ok(rec.grid.x>=-1 && rec.grid.right<=width+1 && rec.grid.bottom<=height+1,"Map offscreen");
 assert.ok(rec.navigation.y>=rec.grid.bottom-1,"Navigation overlaps grid");
 assert.ok(await page.getByTestId("sector-game-resources").getByText("👤 110").isVisible());
 // React Native Web often places 'left' in a generated CSS class, not img.style.
 // Observe computed atlas crop coordinates while running, then ensure they remain fixed in pause.
 const firstSprite=page.getByTestId("resident-human-lpc").first().locator("img").first();
 const spriteOffset=()=>firstSprite.evaluate(el=>getComputedStyle(el).left);
 const before=await spriteOffset();
 await page.getByTestId("sector-game-pause").click(); // resume
 await page.getByRole("button",{name:"Metti in pausa il tempo"}).waitFor({state:"visible"});
 try {
   await page.waitForFunction(start=>{
     const element=document.querySelector('[data-testid="resident-human-lpc"] img');
     return !!element && getComputedStyle(element).left!==start;
   },before,{timeout:8000});
 } catch(error) {
   const diagnostic=await firstSprite.evaluate(el=>({
     inlineLeft:el.style.left, computedLeft:getComputedStyle(el).left,
     className:el.className, cssText:el.getAttribute("style"),
     outerHTML:el.outerHTML.slice(0,400)
   }));
   throw new Error("Human LPC animation frame did not change: "+JSON.stringify({before,diagnostic}),{cause:error});
 }
 await page.getByTestId("sector-game-pause").click(); // pause again
 await page.getByRole("button",{name:"Riprendi il tempo"}).waitFor({state:"visible"});
 const stopped=await spriteOffset();
 await page.waitForTimeout(650);
 assert.equal(await spriteOffset(),stopped,"Human LPC frame must freeze when paused");
 await page.getByTestId("sector-game-next-day").click();
 await page.getByText("PROTOTIPO GIOCABILE · Giorno 2").waitFor();
 await page.getByRole("button",{name:"Visita Sud"}).click();
 await page.getByText(/SUD · 22 abitanti/i).waitFor();
 await page.screenshot({path:`sector-screenshots/playable-south-human-lpc-${width}x${height}.png`});
 assert.equal(await page.getByTestId("sector-resident").count(),22,
   "Only the 22 visible south residents should render");
 assert.ok(await page.getByTestId("sector-building-accent").count()>=8,
   "Southern farms should use recognisable crop sprites");
 await page.getByRole("button",{name:"Visita Est"}).click();
 await page.getByText(/EST · 21 abitanti/i).waitFor();
 assert.ok(await page.getByTestId("sector-building-accent").count()>=12,
   "Eastern market buildings should use original crate sprites");
 await page.getByRole("button",{name:"Visita Sud"}).click();
 await page.getByText(/SUD · 22 abitanti/i).waitFor();
 await page.getByRole("button",{name:"Casa",exact:true}).click();
 const box=await page.getByTestId("sector-game-grid").boundingBox();
 const cell=box.width/16;
 await page.getByTestId("sector-game-tap-grid").click({position:{x:cell*.7,y:cell*20.7}});
 const buildMessage=await page.getByTestId("sector-game-notice").textContent();
 assert.match(buildMessage||"",/Casa .* costruita/i,"Construction failed: "+buildMessage);
 // One-tap placement is essential when a 16×24 grid is tiny on a phone.
 await page.getByRole("button",{name:"Fattoria",exact:true}).click();
 const accentsBefore=await page.getByTestId("sector-building-accent").count();
 await page.getByTestId("sector-game-place-building").click();
 const automaticBuild=await page.getByTestId("sector-game-notice").textContent();
 assert.match(automaticBuild||"",/Fattoria .* costruita/i,"One-tap placement failed: "+automaticBuild);
 assert.equal(await page.getByTestId("sector-building-accent").count(),accentsBefore+1,
   "New farm must have a crop sprite");

 await page.getByRole("button",{name:"Ricomincia"}).click();
 await page.getByTestId("sector-game-reset-dialog").waitFor();
 await page.getByTestId("sector-game-reset-cancel").click();
 await page.getByText("PROTOTIPO GIOCABILE · Giorno 2").waitFor();
 await page.getByTestId("sector-game-exit").click();
 await page.getByTestId("choose-sector-mode").waitFor();
 await page.getByTestId("choose-sector-mode").click();
 await page.getByTestId("sector-game-grid").waitFor();
 await page.getByText(/SUD · 22 abitanti/i).waitFor();
 assert.ok(await page.getByTestId("sector-building-accent").count()>8,
   "Auto-placed farm must remain after leaving and resuming");
 assert.equal(errors.length,0,"Runtime errors: "+errors.join("; "));
 console.log("PASS playable mode "+width+"x"+height+": real terrain and human LPC citizens decoded, 384 tiles, visible-only sprites, clock, travel, build, isolated save");
 }finally{await page.close();}
 }
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
