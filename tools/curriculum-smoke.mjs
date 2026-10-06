import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';

const base=process.env.TRAINER_QA_URL??'http://127.0.0.1:4173';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[],failed=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('response',response=>{if(response.status()>=400&&response.url().startsWith(base))failed.push(response.status()+' '+response.url());});

const snap=()=>page.evaluate(()=>window.__sessionQA.snapshot());
const command=value=>page.evaluate(value=>window.__sessionQA.command(value),value);
async function storedAttempt(id){
  return page.evaluate(async id=>{
    const open=indexedDB.open('project-interceptor-training',1);
    const db=await new Promise((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});
    const record=await new Promise((resolve,reject)=>{const request=db.transaction('attempts','readonly').objectStore('attempts').get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    db.close();return record;
  },id);
}
async function waitForAttempt(id,predicate,description){
  const until=Date.now()+20000;
  while(Date.now()<until){const record=await storedAttempt(id);if(record&&predicate(record))return record;await page.waitForTimeout(200);}
  throw new Error(`Timed out waiting for ${description} archive ${id}.`);
}
async function launchLevelOne(mode){
  const card=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Detection & verification'})});
  await card.getByRole('button',{name:mode==='assessment'?'Assessment':'Practice',exact:true}).click();
  await page.getByRole('heading',{name:/Monitor the post/}).waitFor();
  await page.waitForFunction(()=>window.__sessionQA.snapshot().assetsReady);
}

await page.goto(base+'/progress?qa=1');
await page.getByLabel('Active trainee').waitFor();
const profileName=`QA Operator ${Date.now()}`;
await page.getByLabel('New trainee name').fill(profileName);
await page.getByRole('button',{name:'Create profile'}).click();
await page.getByText('Profile created on this device.').waitFor();
await page.getByLabel('Environment setting').selectOption('semi-urban');
await page.getByLabel('Weather conditions').selectOption('rain');

// A practice launch must carry the selected authored setting and weather all
// the way into the simulation snapshot and its 3D observation renderer.
await launchLevelOne('practice');
const practiceSnapshot=await snap();
assert.equal(practiceSnapshot.trainingMode,'practice');
assert.equal(practiceSnapshot.environmentSetting,'semi-urban');
assert.equal(practiceSnapshot.conditions.weather,'rain');
assert.equal(practiceSnapshot.sensorHealth.difficulty,'foundation');
const statusText=await page.getByLabel('Training environment and sensor status').innerText();
assert.match(statusText,/SEMI-URBAN/);assert.match(statusText,/RAIN/);
await page.getByRole('button',{name:/Ground observer/}).click();
await page.waitForFunction(()=>window.__trainerQA?.snapshot().ready,undefined,{timeout:60000});
const renderer=await page.evaluate(()=>window.__trainerQA.snapshot());
assert.equal(renderer.conditions.weather,'rain');
assert.ok(renderer.obstacles.some(item=>item.id==='semi-urban-market'),'Semi-urban facility is present in renderer collision bounds');
assert.ok(renderer.obstacles.filter(item=>item.id.startsWith('semi-urban-')).length>=5,'Semi-urban facility, shelter and barriers are rendered');
await mkdir('artifacts/qa/curriculum',{recursive:true});
await page.screenshot({path:'artifacts/qa/curriculum/semi-urban-rain.png'});
await page.getByRole('link',{name:/Training console/}).click();
await page.getByRole('heading',{name:/Monitor the post/}).waitFor();

// Save an in-progress, interrupted attempt, reload the app, and verify that
// recovery is a held archive rather than a resumable live session.
await page.getByRole('button',{name:/Start exercise/}).click();
assert.equal((await command({type:'step',seconds:15})).ok,true);
assert.equal((await command({type:'resume'})).ok,true);
const interruptedId=(await snap()).sessionId;
assert.ok((await snap()).time>=15);
await page.getByRole('button',{name:/Curriculum/}).click();
await page.getByRole('heading',{name:'Attempt history'}).waitFor();
const interrupted=await waitForAttempt(interruptedId,record=>record.status==='interrupted'&&(record.checkpoints?.length??0)>0,'interrupted checkpoint');
assert.equal(interrupted.mode,'practice');
assert.ok(interrupted.checkpoints.every(item=>item.time<=interrupted.state.time));
await page.reload();
await page.getByLabel('Active trainee').waitFor();
assert.equal((await snap()).status,'ready','Reload starts at a new held-ready session, never resumes the archived run');
await page.getByLabel('Filter by level').selectOption('1');
await page.getByLabel('Filter by mode').selectOption('practice');
await page.getByLabel('Filter by rubric version').selectOption('prototype-1');
const practiceRows=page.locator('tbody tr');
await practiceRows.first().waitFor();
assert.equal(await practiceRows.count(),1);
assert.match(await practiceRows.first().innerText(),/Interrupted/);
await page.screenshot({path:'artifacts/qa/curriculum/interrupted-history.png',fullPage:true});
await practiceRows.first().getByRole('link',{name:/Open AAR/}).click();
await page.getByRole('heading',{name:'Interrupted attempt'}).waitFor();
await page.getByText(/recovered clock is held/i).waitFor();
assert.equal(await page.getByRole('button',{name:'Resume exercise'}).count(),0);
assert.ok((await page.locator('.aar-columns').innerText()).includes('Observed checkpoint'));
await page.goto(base+'/progress?qa=1');
await page.getByRole('heading',{name:'Attempt history'}).waitFor();

// A QA manual step marks the assessment as a demo. Even after a completed
// review and archive, it remains ineligible to unlock the next level.
await launchLevelOne('assessment');
const assessmentBefore=await snap();
assert.equal(assessmentBefore.trainingMode,'assessment');
assert.equal(assessmentBefore.environmentSetting,'semi-urban');
assert.equal(assessmentBefore.conditions.weather,'rain');
await page.getByRole('button',{name:/Start exercise/}).click();
const assessmentStep=await command({type:'step',seconds:30});
assert.equal(assessmentStep.ok,true,assessmentStep.message);
const qaAttempt=await snap();
assert.ok(qaAttempt.eligibilityFlags.includes('demo'));
await page.getByRole('button',{name:'Resume exercise'}).click();
await page.getByRole('button',{name:'Acknowledge track'}).waitFor({timeout:30000});
await page.getByRole('button',{name:'Acknowledge track'}).click();
await page.getByRole('button',{name:'End & review'}).click();
await page.getByRole('heading',{name:'Exercise complete'}).waitFor();
const completedId=(await snap()).sessionId;
const completed=await waitForAttempt(completedId,record=>record.status==='completed'&&Boolean(record.state.review)&&Boolean(record.resolvedRecipe),'completed recipe');
assert.equal(completed.mode,'assessment');
assert.ok(completed.eligibilityFlags.includes('demo'));
assert.equal(completed.resolvedRecipe.version,1);
assert.equal(completed.resolvedRecipe.setting,'semi-urban');
assert.equal(completed.resolvedRecipe.generation.resolvedSeed,completed.seed);
assert.equal(completed.resolvedRecipe.sensorHealth.difficulty,'foundation');
await page.getByRole('button',{name:/Open replay/}).click();
await page.getByRole('heading',{name:'After action review'}).waitFor();
await page.goto(base+'/progress?qa=1');
await page.getByRole('heading',{name:'Attempt history'}).waitFor();
await page.getByRole('article').filter({has:page.getByRole('heading',{name:'Ambiguity & restraint'})}).getByRole('button',{name:'Assessment locked'}).waitFor();
assert.match(await page.locator('.progress-stats').innerText(),/1\s+Highest unlocked assessment/);

// The history filters isolate each status and curriculum dimension.
await page.getByLabel('Filter by level').selectOption('1');
await page.getByLabel('Filter by rubric version').selectOption('prototype-1');
await page.getByLabel('Filter by mode').selectOption('assessment');
assert.equal(await page.locator('tbody tr').count(),1);
assert.match(await page.locator('tbody tr').first().innerText(),/demo/);
await page.getByLabel('Filter by mode').selectOption('practice');
assert.equal(await page.locator('tbody tr').count(),1);
assert.match(await page.locator('tbody tr').first().innerText(),/Interrupted/);
await page.getByLabel('Filter by mode').selectOption('all');
await page.getByLabel('Filter by level').selectOption('all');
await page.getByLabel('Filter by rubric version').selectOption('all');
await page.screenshot({path:'artifacts/qa/curriculum/progress.png',fullPage:true});

// Round-trip the completed scenario recipe through a versioned unit bundle.
const bundleDownloadPromise=page.waitForEvent('download');
await page.getByRole('button',{name:'Export unit bundle'}).click();
const bundleDownload=await bundleDownloadPromise;
const bundlePath=await bundleDownload.path();
const exportedBundle=JSON.parse(await readFile(bundlePath,'utf8'));
assert.equal(exportedBundle.format,'project-interceptor-training');
const exportedCompleted=exportedBundle.attempts.find(attempt=>attempt.id===completedId);
assert.ok(exportedCompleted?.resolvedRecipe,'Completed attempt export contains its resolved recipe');

// Import into a clean browser context, then export again to verify recipe data
// survives validation, persistence, and a second bundle serialization.
const importPage=await browser.newPage({viewport:{width:1280,height:800}});
importPage.on('pageerror',error=>errors.push(String(error)));
importPage.on('response',response=>{if(response.status()>=400&&response.url().startsWith(base))failed.push(response.status()+' '+response.url());});
await importPage.goto(base+'/progress?qa=1');
await importPage.getByLabel('Active trainee').waitFor();
await importPage.getByLabel('Import training bundle').setInputFiles(bundlePath);
await importPage.getByText(/Imported \d+ attempts and \d+ profiles/).waitFor();
await importPage.getByLabel('Active trainee').selectOption(completed.profileId);
await importPage.locator('tbody tr').first().waitFor();
assert.equal(await importPage.locator('tbody tr').count(),2);
const roundTripDownloadPromise=importPage.waitForEvent('download');
await importPage.getByRole('button',{name:'Export unit bundle'}).click();
const roundTripDownload=await roundTripDownloadPromise;
const roundTripBundle=JSON.parse(await readFile(await roundTripDownload.path(),'utf8'));
const roundTripCompleted=roundTripBundle.attempts.find(attempt=>attempt.id===completedId);
assert.deepEqual(roundTripCompleted.resolvedRecipe,exportedCompleted.resolvedRecipe);

// Retain the command-room renderer smoke check on the clean import context.
await importPage.goto(base+'/room?qa=1');
await importPage.waitForFunction(()=>window.__roomQA?.ready(),undefined,{timeout:60000});
await importPage.waitForFunction(()=>window.__sessionQA.snapshot().assetsReady);
await importPage.screenshot({path:'artifacts/qa/curriculum/room.png'});
const resources=await importPage.evaluate(()=>window.__roomQA.resources());
assert.ok(resources.meshes>30);
await importPage.evaluate(()=>window.__sessionQA.command({type:'step',seconds:30}));
await importPage.evaluate(()=>window.__sessionQA.command({type:'resume'}));
await importPage.evaluate(()=>{const contact=window.__sessionQA.exercise().tracks[0];window.__roomQA.action({type:'acknowledge-track',contactId:contact.id});window.__roomQA.action({type:'finish'});});
assert.equal((await importPage.evaluate(()=>window.__sessionQA.exercise())).status,'completed');
assert.deepEqual(errors,[],'No browser JavaScript errors');
assert.deepEqual(failed,[],'No local asset failures');
await browser.close();
console.log('Environment/weather, held interruption, filters, progression exclusion, recipe bundle and room checks PASS');
