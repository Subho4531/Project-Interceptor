import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.TRAINER_QA_URL??'http://127.0.0.1:4173';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[],external=[],failed=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('response',response=>{if(response.status()>=400&&response.url().startsWith(base))failed.push(response.url());});
await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.protocol.startsWith('http')&&url.origin!==new URL(base).origin){external.push(url.href);return route.abort();}return route.continue();});
for(const route of ['progress','trainer','dashboard','observer','room']){
  await page.goto(`${base}/${route}?qa=1`);
  await page.waitForFunction(()=>window.__sessionQA?.snapshot().assetsReady,undefined,{timeout:60000});
  if(route==='dashboard'){await page.getByRole('button',{name:'Tactical map',exact:true}).click();await page.waitForTimeout(1200);}
  if(route==='observer')await page.waitForFunction(()=>window.__trainerQA?.snapshot().ready,undefined,{timeout:60000});
  if(route==='room')await page.waitForFunction(()=>window.__roomQA?.ready(),undefined,{timeout:60000});
}
assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[],'Core routes use local assets without external services');
await browser.close();console.log('Local-only static routes PASS');
