// End-to-end browser smoke for the playable sector mode (not native device verification).
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
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
 await page.getByTestId("sector-game-next-day").click();
 await page.getByText("PROTOTIPO GIOCABILE · Giorno 2").waitFor();
 await page.getByRole("button",{name:"Visita Sud"}).click();
 await page.getByText(/SUD · 22 abitanti/i).waitFor();
 await page.getByRole("button",{name:"Casa",exact:true}).click();
 const box=await page.getByTestId("sector-game-grid").boundingBox();
 const cell=box.width/16;
 await page.getByTestId("sector-game-tap-grid").click({position:{x:cell*.7,y:cell*20.7}});
 const buildMessage=await page.getByTestId("sector-game-notice").textContent();
 assert.match(buildMessage||"",/Casa .* costruita/i,"Construction failed: "+buildMessage);
 await page.getByTestId("sector-game-exit").click();
 await page.getByTestId("choose-sector-mode").waitFor();
 await page.getByTestId("choose-sector-mode").click();
 await page.getByTestId("sector-game-grid").waitFor();
 await page.getByText(/SUD · 22 abitanti/i).waitFor();
 assert.equal(errors.length,0,"Runtime errors: "+errors.join("; "));
 console.log("PASS playable mode "+width+"x"+height+": selection, grid, clock, travel, build, isolated resume");
 }finally{await page.close();}
 }
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
