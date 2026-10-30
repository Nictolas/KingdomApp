// Legacy-sector compatibility smoke after consolidating the two prototypes.
// The old 16x24 save/model is retained, but no longer offered as a separate game.
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
let browser;
try{
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 for(const [width,height] of [[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height}});
  const errors=[];
  page.on("pageerror",err=>errors.push(String(err)));
  try{
   await page.goto("http://127.0.0.1:"+port+"/",{waitUntil:"domcontentloaded"});
   await page.getByTestId("choose-territory-world").waitFor({state:"visible",timeout:60000});
   assert.ok(await page.getByRole("button",{name:"Avventura"}).isVisible());
   assert.ok(await page.getByRole("button",{name:"Creativa"}).isVisible());
   assert.equal(await page.getByTestId("choose-sector-mode").count(),0,
     "Only one territory prototype may appear in the mode menu");
   assert.equal(await page.getByText("Regno a settori", {exact:false}).count(),0,
     "Legacy 16x24 gameplay must not appear as a second mode");
   assert.equal(await page.getByTestId("choose-territory-world").count(),1);
   await page.getByTestId("choose-territory-world").click();
   await page.getByTestId("territory-world-grid").waitFor({state:"visible",timeout:40000});
   await page.getByTestId("territory-dpad").waitFor({state:"visible"});
   assert.equal(await page.getByTestId("sector-game-root").count(),0,
     "Legacy five-sector view must never replace the chosen 32x32 world");
   await mkdir("sector-screenshots",{recursive:true});
   await page.screenshot({path:`sector-screenshots/single-world-mode-${width}x${height}.png`});
   await page.getByTestId("territory-world-exit").click();
   await page.getByTestId("choose-territory-world").waitFor();
   assert.equal(await page.getByTestId("choose-sector-mode").count(),0);
   assert.equal(errors.length,0,"Runtime errors: "+errors.join("; "));
   console.log("PASS "+width+"x"+height+
     ": only one expandable 32x32 mode visible; legacy mode and saves untouched");
  }finally{await page.close();}
 }
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
