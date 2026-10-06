import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.TRAINER_QA_URL??'http://127.0.0.1:4173';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[];page.on('pageerror',error=>errors.push(String(error)));
await page.goto(base+'/trainer?qa=1');
await page.waitForFunction(()=>window.__sessionQA?.snapshot().assetsReady,undefined,{timeout:60000});
const cases=[
  {id:'ambiguous',entities:0,contacts:1,truth:'non-uav'},
  {id:'friendly',entities:1,contacts:1,truth:'uav'},
  {id:'coordinated',entities:4,contacts:4,truth:'uav'},
  {id:'mixed',entities:2,contacts:2,truth:'uav'},
];
for(const example of cases){
  await page.getByLabel('Training exercise').selectOption(example.id);
  await page.getByRole('button',{name:/Start exercise/}).click();
  await page.evaluate(()=>window.__sessionQA.command({type:'step',seconds:30}));
  const session=await page.evaluate(()=>window.__sessionQA.snapshot());
  const state=await page.evaluate(()=>window.__sessionQA.exercise());
  assert.equal(session.tracks.length,example.entities);
  assert.equal(state.tracks.length,example.contacts);
  assert.equal(JSON.stringify(state).includes('sensor-only-return-1'),false);
  assert.equal(JSON.stringify(state).includes('aerial-01'),false);
  await page.evaluate(()=>window.__sessionQA.command({type:'resume'}));
  await page.getByRole('button',{name:'Acknowledge track'}).click();
  await page.getByRole('button',{name:/Movement history/}).click();
  await page.getByRole('button',{name:/Check flight roster/}).click();
  await page.evaluate(()=>window.__sessionQA.command({type:'step',seconds:8}));
  await page.evaluate(()=>window.__sessionQA.command({type:'resume'}));
  await page.getByRole('button',{name:'End & review'}).click();
  const review=await page.evaluate(()=>window.__sessionQA.exercise().review);
  assert.equal(review.groundTruth.objectType,example.truth);
  assert.ok(Number.isFinite(review.overall));
  await page.getByRole('button',{name:'Repeat exercise'}).click();
}
assert.deepEqual(errors,[]);
await browser.close();
console.log('Authored sensor scenarios PASS');
