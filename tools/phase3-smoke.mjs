import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:4181/observer?qa=1');
const results=[];
for(const postId of ['shakti-punjab','maru-rajasthan','himadri-sikkim']){
  if(postId!=='shakti-punjab') await page.evaluate(postId=>window.__sessionQA.command({type:'post',postId,discardConfirmed:true}),postId);
  await page.waitForFunction(post=>window.__trainerQA?.snapshot().ready&&window.__trainerQA.snapshot().postId===post,postId,{timeout:45000});
  await page.waitForTimeout(300);
  const ds=await page.evaluate(()=>window.__trainerQA.snapshot());
  assert.ok(ds.aerialReady);
  assert.ok(ds.terrainProbes.every(p=>p.rendered!==undefined&&Math.abs(p.error)<.02));
  assert.ok(ds.obstacles.length>50);
  assert.equal(await page.getByText('Asset loading issues',{exact:false}).count(),0);
  await page.evaluate(()=>window.__trainerQA.start());
  await page.waitForTimeout(350);
  await page.screenshot({path:'artifacts/qa/phase3/'+postId+'-environment.png'});
  await page.evaluate(()=>window.__trainerQA.pause());
  results.push({postId,terrainProbes:ds.terrainProbes,obstacles:ds.obstacles.length,meshes:ds.meshes,materials:ds.materials,renderer:ds.renderer});
  console.log(postId+' environment PASS');
}
assert.deepEqual(errors,[]);
await writeFile('artifacts/qa/phase3/environments-report.json',JSON.stringify({date:new Date().toISOString(),browser:browser.version(),viewport:{width:1280,height:720},results,errors},null,2));
await browser.close();

