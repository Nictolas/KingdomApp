import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir,readFile} from "node:fs/promises";
import {extname,resolve} from "node:path";
import {chromium} from "playwright";
import {findStaticPreviewFile} from "./sector-preview-static-server.mjs";

const root=resolve(process.argv[2]||"dist");
const mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",
 ".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".woff2":"font/woff2"};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url||"/","http://localhost").pathname);
  const file=await findStaticPreviewFile(root,path);
  if(!file){res.writeHead(404);res.end("Not found");return;}
  res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream"});
  res.end(await readFile(file));
 }catch{res.writeHead(500);res.end("Error");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const port=server.address().port;
let browserInstance;
try{
 browserInstance=await chromium.launch({headless:true,args:["--no-sandbox"]});
 for(const [width,height] of [[390,844],[320,568]]){
  const page=await browserInstance.newPage({viewport:{width,height}});
  const errors=[];
  page.on("pageerror",e=>errors.push(String(e)));
  try{
   await page.goto("http://127.0.0.1:"+port+"/",{waitUntil:"domcontentloaded"});
   await page.getByTestId("choose-territory-world").waitFor({state:"visible",timeout:60000});
   assert.ok(await page.getByRole("button",{name:"Avventura"}).isVisible());
   assert.ok(await page.getByRole("button",{name:"Creativa"}).isVisible());
   assert.ok(await page.getByTestId("choose-sector-mode").isVisible());
   await page.getByTestId("choose-territory-world").click();
   await page.getByTestId("territory-world-grid").waitFor({state:"visible",timeout:45000});
   await page.getByTestId("territory-world-pause").click();
   await page.waitForFunction(()=>{
     const grid=document.querySelector('[data-testid="territory-world-grid"]');
     if(!grid)return false;
     const cells=grid.querySelectorAll('[data-testid="territory-world-tile"]');
     const people=grid.querySelectorAll('[data-testid="territory-world-resident"]');
     const images=Array.from(grid.querySelectorAll("img"));
     return cells.length===144 && people.length>0 && images.length>=145 &&
       images.every(img=>img.complete&&img.naturalWidth>0);
   },undefined,{timeout:40000});
   await mkdir("territory-screenshots",{recursive:true});
   await page.screenshot({path:`territory-screenshots/new-capital-${width}x${height}.png`,fullPage:true});
   const measure=await page.evaluate(()=>{
     const grid=document.querySelector('[data-testid="territory-world-grid"]').getBoundingClientRect();
     const w=innerWidth,h=innerHeight;
     return {w:grid.width,h:grid.height,left:grid.left,right:grid.right,bottom:grid.bottom,screenW:w,screenH:h};
   });
   assert.ok(Math.abs(measure.w-measure.h)<2,"32x32 viewport must be square");
   assert.ok(measure.left>=-1&&measure.right<=width+1&&measure.bottom<=height+1,"Grid does not fit mobile screen");
   await page.getByRole("button",{name:"Scorri mappa verso destra"}).click();
   await page.getByText("11–22 / 6–17").waitFor();
   await page.getByRole("button",{name:"Scorri mappa verso sinistra"}).click();
   await page.getByTestId("territory-open-map").click();
   await page.getByTestId("territory-map-grid").waitFor();
   assert.equal(await page.getByTestId("territory-map-grid").getByRole("button").count(),25);
   await page.getByTestId("territory-map-cell-1,0").click();
   await page.getByTestId("territory-map-selected").getByText(/Acquisto:/).waitFor();
   await page.getByTestId("territory-map-buy").click();
   await page.getByTestId("territory-world-label").getByText(/1,0/).waitFor();
   await page.getByText(/2 territori/).waitFor();
   assert.equal(await page.getByTestId("territory-world-tile").count(),144);
   await page.getByTestId("territory-tool-house").click();
   await page.getByTestId("territory-world-auto-build").click();
   const message=await page.getByTestId("territory-world-notice").textContent();
   assert.match(message||"",/Casa \d+ costruita/i,"House construction failed: "+message);
   await page.screenshot({path:`territory-screenshots/claimed-territory-${width}x${height}.png`,fullPage:true});
   await page.getByTestId("territory-world-next-day").click();
   await page.getByText(/Giorno 2/).waitFor();
   await page.getByTestId("territory-open-map").click();
   await page.getByTestId("territory-map-cell-0,0").click();
   await page.getByTestId("territory-map-visit").click();
   await page.getByTestId("territory-world-label").getByText(/Territorio iniziale/).waitFor();
   await page.getByTestId("territory-world-exit").click();
   await page.getByTestId("choose-territory-world").waitFor();
   await page.getByTestId("choose-territory-world").click();
   await page.getByText(/2 territori/).waitFor();
   await page.getByText(/Giorno 2/).waitFor();
   await page.getByTestId("territory-open-map").click();
   await page.getByTestId("territory-map-cell-1,0").click();
   await page.getByTestId("territory-map-visit").click();
   assert.ok(await page.getByTestId("territory-world-building").count()>=1,
     "House persisted and is visible after reopening");
   await page.getByTestId("territory-world-reset-dialog").count().then(n=>assert.equal(n,0));
   assert.equal(errors.length,0,"Runtime errors: "+errors.join(" | "));
   console.log("PASS expandable 32x32 "+width+"x"+height+
     ": real atlas, viewport, expansion purchase, build, background day, isolated resume");
  }finally{await page.close();}
 }
}finally{
 if(browserInstance)await browserInstance.close();
 await new Promise(ok=>server.close(ok));
}
