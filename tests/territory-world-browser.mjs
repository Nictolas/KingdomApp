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
     const residents=Array.from(document.querySelectorAll('[data-testid="territory-world-resident"]'));
     const lpc=Array.from(document.querySelectorAll('[data-testid="resident-human-lpc"]'));
     return residents.length>0 && lpc.length===residents.length &&
       lpc.every(h=>Array.from(h.querySelectorAll("img")).filter(img=>img.complete&&img.naturalWidth>0).length>=2) &&
       !document.querySelector('[data-testid="territory-resident-image"]');
   },undefined,{timeout:45000});
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
   // The central lower compass changes territories, not the camera.
   const dpad=page.getByTestId("territory-dpad");
   await dpad.waitFor({state:"visible"});
   for(const dir of ["n","s","e","w"]){
     assert.ok(await page.getByTestId("territory-dpad-"+dir).isVisible());
   }
   assert.ok(await page.getByTestId("territory-dpad-center").isVisible());
   const dpadBounds=await dpad.boundingBox();
   assert.ok(dpadBounds,"The territory D-pad must have dimensions");
   assert.ok(Math.abs(dpadBounds.x+dpadBounds.width/2-width/2)<5,
     "D-pad must be horizontally centered, not next to the camera arrows");
   assert.ok(dpadBounds.y+dpadBounds.height<=height+2,
     "D-pad must fit above the phone safe-area bottom");
   assert.ok(dpadBounds.y>height-190,"D-pad must stay near the bottom");
   await page.screenshot({path:`territory-screenshots/new-capital-${width}x${height}.png`,fullPage:true});
   await page.getByTestId("territory-dpad-center").click();
   await page.getByTestId("territory-map-grid").waitFor();
   await page.getByTestId("territory-map-close").click();
   await page.getByTestId("territory-map-grid").waitFor({state:"hidden"});
   const cameraBeforeFrontier=await page.getByTestId("territory-world-visible-range").textContent();
   const resourcesBeforeFrontier=await page.getByTestId("territory-world-resources").textContent();
   await page.getByTestId("territory-dpad-e").click();
   await page.getByTestId("territory-map-selected").filter({hasText:/Acquisto:/}).waitFor();
   assert.ok(await page.getByTestId("territory-map-cell-1,0")
     .getAttribute("aria-selected")==="true",
     "East from the capital must preselect the eastern frontier");
   assert.equal(await page.getByTestId("territory-world-resources").textContent(),
     resourcesBeforeFrontier,"Opening frontier via D-pad must not spend resources");
   await page.getByTestId("territory-map-close").click();
   await page.getByTestId("territory-map-grid").waitFor({state:"hidden"});
   assert.equal(await page.getByTestId("territory-world-visible-range").textContent(),
     cameraBeforeFrontier,"Direction pad must not pan the interior camera");
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
   // React Native Web fades the transparent Modal in. Inspect its completed
   // visual state, never the semi-transparent entry animation.
   await page.waitForTimeout(450);
   assert.equal(await page.getByTestId("territory-map-grid").getByRole("button").count(),25);
   // A geographical map must reveal the biome for an owned/frontier tile,
   // while undiscovered distant cells remain fogged.
   const coloredFrontier=page.getByTestId("territory-map-cell-1,0");
   assert.ok(await coloredFrontier.getByText(/Bosco|Pianura|Colline|Palude|Terre aride/).isVisible(),
     "The preview must show the real biome, not just a generic square");
   await page.screenshot({
     path:`territory-screenshots/biome-frontier-map-${width}x${height}.png`,
     fullPage:true
   });
   // The 5×5 overview is a scrollable window, never a five-sector limit.
   // Moving the overview does not spend resources or move citizens.
   const beforePan=await page.getByTestId("territory-world-resources").textContent();
   await page.getByTestId("territory-map-pan-east").click();
   await page.getByTestId("territory-map-cell-4,0").waitFor();
   await page.getByTestId("territory-map-center-label").filter({hasText:"3,0"}).waitFor();
   await page.getByTestId("territory-map-pan-north").click();
   await page.getByTestId("territory-map-cell-4,-3").waitFor();
   await page.getByTestId("territory-map-pan-center").click();
   await page.getByTestId("territory-map-center-label").filter({hasText:"0,0"}).waitFor();
   await page.getByTestId("territory-map-cell-1,0").waitFor();
   assert.equal(await page.getByTestId("territory-world-resources").textContent(),beforePan,
      "Panning the overview must not alter the game or spend resources");
   await page.getByTestId("territory-map-cell-1,0").click();
   await page.getByTestId("territory-map-selected").filter({hasText:/Acquisto:/}).waitFor();
   await page.getByTestId("territory-map-buy").click();
   await page.getByTestId("territory-map-grid").waitFor({state:"hidden",timeout:6000});
   await page.getByTestId("territory-world-label").filter({hasText:/1,0/}).waitFor();
   await page.getByText(/2 territori/).first().waitFor();
   // A claimed adjacent sector is visited immediately, with no purchase modal
   // and no resource deduction. East and West act as territory switches.
   const resourcesAfterPurchase=await page.getByTestId("territory-world-resources").textContent();
   await page.getByTestId("territory-dpad-w").click();
   await page.getByTestId("territory-world-label").filter({hasText:/Territorio iniziale/}).waitFor();
   assert.equal(await page.getByTestId("territory-map-grid").isVisible(),false);
   await page.getByTestId("territory-dpad-e").click();
   await page.getByTestId("territory-world-label").filter({hasText:/1,0/}).waitFor();
   assert.equal(await page.getByTestId("territory-world-resources").textContent(),
     resourcesAfterPurchase,"Switching between owned sectors must cost nothing");
   assert.equal(await page.getByTestId("territory-world-tile").count(),144);
   assert.ok(await page.getByTestId("territory-tool-bridge").isVisible(),
     "The bridge tool must be available for crossing a river");
   await page.getByTestId("territory-tool-house").click();
   await page.getByTestId("territory-world-auto-build").click();
   const message=await page.getByTestId("territory-world-notice").textContent();
   assert.match(message||"",/Casa \d+ costruita/i,"House construction failed: "+message);
   await page.getByTestId("territory-world-local-stats").filter({hasText:"1 edifici"}).waitFor();
   // Auto-placement must focus the newly created home, rather than building
   // invisibly at the far end of a 32×32 territory.
   await page.getByTestId("territory-world-building").first().waitFor({state:"visible"});

   await page.waitForTimeout(300); // Capture the map after the modal exit fade.
   await page.screenshot({path:`territory-screenshots/claimed-territory-${width}x${height}.png`,fullPage:true});
   await page.getByTestId("territory-world-next-day").click();
   await page.getByText("32×32 · Giorno 2",{exact:true}).waitFor();
   await page.getByTestId("territory-open-map").click();
   await page.getByTestId("territory-map-cell-0,0").click();
   await page.getByTestId("territory-map-visit").click();
   await page.getByTestId("territory-world-label").filter({hasText:/Territorio iniziale/}).waitFor();
   await page.getByTestId("territory-world-exit").click();
   await page.getByTestId("choose-territory-world").waitFor();
   await page.getByTestId("choose-territory-world").click();
   await page.getByText(/2 territori/).first().waitFor();
   await page.getByText("32×32 · Giorno 2",{exact:true}).waitFor();
   await page.getByTestId("territory-open-map").click();
   await page.getByTestId("territory-map-cell-1,0").click();
   await page.getByTestId("territory-map-visit").click();
   // Verify persistence directly from the local territory's model-backed UI.
   // A saved building can be located outside the current viewport even when
   // the camera shows 12×12 of this world's 32×32 grid.
   await page.getByTestId("territory-world-local-stats")
     .filter({hasText:"1 edifici"}).waitFor();
   // Then verify the building actually renders when the camera reaches it.
   // At zoom 16×16, four corners cover the ENTIRE 32×32 territory.
   const clickCamera=async(name,count=1)=>{
     for(let i=0;i<count;i++)await page.getByRole("button",{name}).click();
   };
   await clickCamera("Riduci ingrandimento",2);
   await clickCamera("Scorri mappa verso sinistra");
   await clickCamera("Scorri mappa verso l'alto");
   let builtVisible=await page.getByTestId("territory-world-building").count()>0;
   if(!builtVisible){
     await clickCamera("Scorri mappa verso destra",4);
     builtVisible=await page.getByTestId("territory-world-building").count()>0;
   }
   if(!builtVisible){
     await clickCamera("Scorri mappa verso il basso",4);
     builtVisible=await page.getByTestId("territory-world-building").count()>0;
   }
   if(!builtVisible){
     await clickCamera("Scorri mappa verso sinistra",4);
     builtVisible=await page.getByTestId("territory-world-building").count()>0;
   }
   assert.ok(builtVisible,
     "The saved building exists but did not render when scanning all 32×32 tiles");
   await page.screenshot({
     path:`territory-screenshots/reopened-saved-building-${width}x${height}.png`,
     fullPage:true
   });
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
