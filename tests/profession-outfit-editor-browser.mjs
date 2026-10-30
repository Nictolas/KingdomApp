// Interactive web regression for the profession editor; not a physical phone test.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir,readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium } from "playwright";
import { findStaticPreviewFile } from "./sector-preview-static-server.mjs";

const root=resolve(process.argv[2]||"dist");
const mime={".html":"text/html",".js":"text/javascript",".css":"text/css",
  ".json":"application/json",".png":"image/png",".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",".svg":"image/svg+xml",".woff2":"font/woff2"};
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url||"/","http://localhost").pathname);
    const file=await findStaticPreviewFile(root,path);
    if(!file){res.writeHead(404);res.end("not found");return;}
    res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream"});
    res.end(await readFile(file));
  }catch{res.writeHead(500);res.end("error");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
let browser;
try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  for(const [width,height] of [[390,844],[320,568]]){
    const page=await browser.newPage({viewport:{width,height}});
    const errors=[];
    page.on("pageerror",e=>errors.push(String(e)));
    try{
      await page.goto("http://127.0.0.1:"+server.address().port+"/",{waitUntil:"domcontentloaded"});
      await page.getByTestId("choose-outfit-editor").waitFor({timeout:60000});
      const savesBefore=await page.evaluate(()=>Object.entries(localStorage)
        .filter(([k])=>k.includes("mykingdom.save")||k.includes("sectors:playable")));
      await page.getByTestId("choose-outfit-editor").click();
      await page.getByTestId("profession-editor-root").waitFor();
      await page.getByTestId("profession-editor-edit").waitFor();
      assert.equal(await page.getByTestId("profession-editor-roles").getByRole("button").count(),15);
      await page.getByTestId("profession-role-agricoltore").click();
      await page.getByTestId("profession-editor-other-faces").click();
      // Both previews must contain decoded LPC images: a blank portrait is a regression.
      try{
        await page.waitForFunction(()=>{
          const box=document.querySelector('[data-testid="profession-editor-previews"]');
          if(!box || box.children.length!==2)return false;
          return Array.from(box.children).every(child=>{
            const imgs=Array.from(child.querySelectorAll("img"));
            return imgs.filter(img=>img.complete && img.naturalWidth>0).length>=2;
          });
        },undefined,{timeout:15000});
      }catch(err){
        await mkdir("profession-editor-screenshots",{recursive:true});
        await page.screenshot({path:`profession-editor-screenshots/MISSING-PORTRAIT-${width}x${height}.png`});
        const details=await page.evaluate(()=>{
          const box=document.querySelector('[data-testid="profession-editor-previews"]');
          return Array.from(box?.children||[]).map(el=>({
            imageCount:el.querySelectorAll("img").length,
            loaded:Array.from(el.querySelectorAll("img")).filter(img=>img.complete&&img.naturalWidth>0).length,
            labels:el.textContent?.slice(0,100)
          }));
        });
        throw new Error("Profession LPC portrait is blank: "+JSON.stringify(details),{cause:err});
      }

      await mkdir("profession-editor-screenshots",{recursive:true});
      await page.screenshot({path:`profession-editor-screenshots/overview-${width}x${height}.png`,fullPage:true});
      await page.getByTestId("profession-editor-edit").click();
      await page.getByText("Divisa: Contadino").waitFor();
      assert.ok(!await page.getByRole("tab",{name:"Identità"}).count(),
        "Clothing editor must not offer edits to identity");
      assert.ok(!await page.getByRole("tab",{name:"Capelli"}).count(),
        "Clothing editor must not offer edits to hair");
      await page.getByText("Salva abiti",{exact:true}).click();
      await page.getByTestId("profession-editor-notice").getByText(/divisa Contadino salvata/i).waitFor();
      await page.getByTestId("profession-editor-export").click();
      const shared=await page.getByTestId("profession-editor-export-text").textContent();
      assert.match(shared||"",/Contadino \[agricoltore\]/,
        "Export must include saved profession for developer review");
      assert.match(shared||"",/Busto:/);
      assert.ok(!(shared||"").includes("skinTone") && !(shared||"").includes("hairStyle"),
        "Export may include only uniform choices, never individual faces");

      const savesAfter=await page.evaluate(()=>Object.entries(localStorage)
        .filter(([k])=>k.includes("mykingdom.save")||k.includes("sectors:playable")));
      assert.deepEqual(savesAfter,savesBefore,"Editor must not touch saves");
      await page.getByTestId("profession-editor-exit").click();
      await page.getByTestId("choose-outfit-editor").waitFor();
      await page.reload({waitUntil:"domcontentloaded"});
      await page.getByTestId("choose-outfit-editor").click();
      await page.getByTestId("profession-editor-root").waitFor();
      await page.getByText(/Contadino · divisa personalizzata/).waitFor();
      await page.getByTestId("profession-editor-reset").click();
      await page.getByText(/Ripristinato l'abbigliamento originale/i).waitFor();
      assert.equal(errors.length,0,"Runtime errors: "+errors.join("; "));
      console.log("PASS profession outfit editor "+width+"x"+height+
        ": menu, two previews, clothing-only, save/reload/reset, isolated game saves");
    }finally{await page.close();}
  }
}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));}
