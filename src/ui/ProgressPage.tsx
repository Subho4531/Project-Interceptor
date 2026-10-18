import { useEffect, useState } from 'react';
import { exportBundle, importBundle, listAttempts, listProfiles, saveProfile, type ExerciseArchive, type TrainingProfile } from '../training/AttemptStore';
import { unlockedLevel, type TrainingLevel, type TrainingMode } from '../training/Progression';
import type { EnvironmentSetting } from '../simulation/EnvironmentVariants';
import type { Conditions } from '../simulation/types';
import { useSession } from '../session/SessionContext';
import { appBase, appLink } from '../routing';
import BrandIcon from './BrandIcon';
import './sensor-console.css';
import './progress.css';

const levels=[
  {id:0 as const,title:'Familiarisation',detail:'Learn the controls, evidence ages and report workflow.'},
  {id:1 as const,title:'Detection & verification',detail:'Notice a neutral return and compare evidence before reporting.'},
  {id:2 as const,title:'Ambiguity & restraint',detail:'Investigate uncertain or authorized activity without assuming threat.'},
  {id:3 as const,title:'Prioritisation',detail:'Handle multiple returns, compare histories and revise assessments.'},
  {id:4 as const,title:'Coordinated incident',detail:'Assess related contacts under degraded evidence and use authorized decisions.'},
];
function download(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export default function ProgressPage(){
  const controller=useSession();
  const [profiles,setProfiles]=useState<TrainingProfile[]>([]),[attempts,setAttempts]=useState<ExerciseArchive[]>([]),[profileId,setProfileId]=useState(()=>{try{return localStorage.getItem('interceptor-active-profile')??'';}catch{return '';}}),[name,setName]=useState(''),[seed,setSeed]=useState(26052),[notice,setNotice]=useState(''),[unit,setUnit]=useState(false),[levelFilter,setLevelFilter]=useState('all'),[modeFilter,setModeFilter]=useState('all'),[rubricFilter,setRubricFilter]=useState('all');
  const [environmentSetting,setEnvironmentSetting]=useState<EnvironmentSetting>(()=>{try{return localStorage.getItem('interceptor-environment-setting')==='semi-urban'?'semi-urban':'rural';}catch{return 'rural';}});
  const [weather,setWeather]=useState<NonNullable<Conditions['weather']>>(()=>{try{const saved=localStorage.getItem('interceptor-weather');return saved==='fog'||saved==='rain'?saved:'clear';}catch{return 'clear';}});
  async function refresh(){
    let stored=await listProfiles();
    if(!stored.length){const profile={id:'local-default',name:'Local trainee',createdAt:new Date().toISOString()};await saveProfile(profile);stored=[profile];}
    setProfiles(stored);setAttempts(await listAttempts());
    setProfileId(current=>stored.some(profile=>profile.id===current)?current:stored[0].id);
  }
  useEffect(()=>{void refresh().catch(error=>setNotice(`Local history unavailable: ${String(error)}`));},[]);
  useEffect(()=>{if(profileId)try{localStorage.setItem('interceptor-active-profile',profileId);}catch{setNotice('The selected profile cannot be retained between reloads.');}},[profileId]);
  useEffect(()=>{try{localStorage.setItem('interceptor-environment-setting',environmentSetting);localStorage.setItem('interceptor-weather',weather);}catch{/* Settings remain active for this page. */}},[environmentSetting,weather]);
  const rubrics=[...new Set(attempts.map(attempt=>attempt.rubricVersion??'legacy'))].sort();
  const selected=attempts.filter(attempt=>(unit||attempt.profileId===profileId)&&(levelFilter==='all'||(levelFilter==='legacy'?attempt.level===undefined:String(attempt.level)===levelFilter))&&(modeFilter==='all'||attempt.mode===modeFilter)&&(rubricFilter==='all'||(attempt.rubricVersion??'legacy')===rubricFilter));
  const completed=selected.filter(attempt=>attempt.state.review&&attempt.status!=='interrupted');
  const scored=completed.filter(attempt=>attempt.level!==0&&attempt.mode!=='demo');
  const unlocked=unlockedLevel(attempts,profileId,'prototype-1');
  const average=scored.length?scored.reduce((sum,attempt)=>sum+attempt.state.review!.overall,0)/scored.length:0;
  const componentAverages=[['detection','Detection'],['classification','Classification'],['threatAssessment','Threat assessment'],['decisionQuality','Decision quality']] as const;
  function launch(level:TrainingLevel,mode:TrainingMode){
    if(!profileId){setNotice('Create or select a trainee profile first.');return;}
    if(controller.getSnapshot().status!=='ready')controller.command({type:'reset',discardConfirmed:true});
    const scenarioId=level<=1?'low-ingress':level===2?(seed%2?'friendly':'ambiguous'):level===3?'mixed':'coordinated';
    const result=controller.prepareTraining({profileId,mode,level,seed,scenarioId,environmentSetting,weather},unlocked);
    if(!result.ok){setNotice(result.message);return;}
    history.pushState(null,'',appLink('dashboard'));window.dispatchEvent(new PopStateEvent('popstate'));
  }
  async function createProfile(){
    const label=name.trim();if(!label){setNotice('Enter a trainee name.');return;}
    const profile={id:crypto.randomUUID(),name:label.slice(0,80),createdAt:new Date().toISOString()};
    try{await saveProfile(profile);setName('');await refresh();setProfileId(profile.id);setNotice('Profile created on this device.');}catch(error){setNotice(String(error));}
  }
  return <main className="sensor-console progress-page">
    <header className="sensor-topbar"><div className="sensor-brand"><span className="sensor-brand-mark"><BrandIcon size={26} /></span><span><strong>PROJECT INTERCEPTOR</strong><small>CURRICULUM / LOCAL PERFORMANCE</small></span></div><nav><a href={appLink('dashboard')}>Command dashboard ↗</a><a href={appLink('room')}>Command room / VR ↗</a></nav></header>
    <div className="progress-content"><span className="sensor-kicker">UNIT-LEVEL TRAINING</span><h1>Build judgment through repeated situations.</h1>
      <section className="profile-bar" aria-label="Trainee profile and exercise conditions"><label>ACTIVE TRAINEE<select aria-label="Active trainee" value={profileId} onChange={event=>setProfileId(event.target.value)}>{profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><form onSubmit={event=>{event.preventDefault();void createProfile();}}><input aria-label="New trainee name" value={name} onChange={event=>setName(event.target.value)} placeholder="New trainee name" maxLength={80}/><button>Create profile</button></form><label>ENVIRONMENT SETTING<select aria-label="Environment setting" value={environmentSetting} onChange={event=>setEnvironmentSetting(event.target.value as EnvironmentSetting)}><option value="rural">Rural outpost</option><option value="semi-urban">Semi-urban approach</option></select></label><label>WEATHER<select aria-label="Weather conditions" value={weather} onChange={event=>setWeather(event.target.value as NonNullable<Conditions['weather']>)}><option value="clear">Clear</option><option value="fog">Fog</option><option value="rain">Rain</option></select></label><label>VARIANT SEED<input aria-label="Curriculum seed" type="number" min="0" max="2147483647" value={seed} onChange={event=>setSeed(Number(event.target.value))}/></label><button onClick={()=>setSeed(current=>(Math.imul(current,1664525)+1013904223)>>>1)}>New variant</button></section>
      {notice&&<p className="progress-notice" role="status">{notice}</p>}
      <div className="progress-stats"><div><b>{completed.length}</b><span>Completed attempts</span></div><div><b>{scored.length?Math.round(average):'—'}</b><span>Average scored overall</span></div><div><b>{unlocked}</b><span>Highest unlocked assessment</span></div><div><b>{selected.filter(attempt=>attempt.status==='interrupted').length}</b><span>Interrupted records</span></div></div>
      <div className="progress-component-stats" aria-label="Average component scores">{componentAverages.map(([key,label])=>{const values=scored.map(attempt=>attempt.state.review!.scores[key]);const mean=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:undefined;return <div key={key}><b>{mean===undefined?'—':Math.round(mean)}</b><span>Average {label.toLowerCase()}</span></div>;})}</div>
      <p className="progress-rule">Practice is open at every level. Unlock the next assessment with two qualifying attempts on different seeds: at least 80 overall, 60 in each component, and no critical error or interruption. Level 0 is unscored familiarisation.</p>
      <section className="curriculum-grid" aria-label="Curriculum levels">{levels.map(level=><article key={level.id}><span className="sensor-kicker">LEVEL {level.id.toString().padStart(2,'0')}</span><h2>{level.title}</h2><p>{level.detail}</p><div><button onClick={()=>launch(level.id,'guided')}>Guided practice</button><button onClick={()=>launch(level.id,'practice')}>Practice</button>{level.id>0&&<button className={level.id<=unlocked?'sensor-primary':''} disabled={level.id>unlocked} onClick={()=>launch(level.id,'assessment')}>{level.id<=unlocked?'Assessment':'Assessment locked'}</button>}</div></article>)}</section>
      <section className="progress-history"><div className="progress-history-heading"><h2>Attempt history</h2><label><input type="checkbox" checked={unit} onChange={event=>setUnit(event.target.checked)}/> All imported profiles</label><label>Level<select aria-label="Filter by level" value={levelFilter} onChange={event=>setLevelFilter(event.target.value)}><option value="all">All levels</option><option value="legacy">Legacy / unassigned</option>{levels.map(level=><option key={level.id} value={level.id}>Level {level.id}</option>)}</select></label><label>Mode<select aria-label="Filter by mode" value={modeFilter} onChange={event=>setModeFilter(event.target.value)}><option value="all">All modes</option>{(['guided','practice','assessment','demo'] as const).map(mode=><option key={mode} value={mode}>{mode}</option>)}</select></label><label>Rubric<select aria-label="Filter by rubric version" value={rubricFilter} onChange={event=>setRubricFilter(event.target.value)}><option value="all">All rubrics</option>{rubrics.map(rubric=><option key={rubric} value={rubric}>{rubric}</option>)}</select></label><button onClick={()=>void exportBundle().then(bundle=>download(bundle,'interceptor-unit-history.json')).catch(error=>setNotice(String(error)))}>Export unit bundle</button><label className="progress-import">Import bundle<input aria-label="Import training bundle" type="file" accept="application/json,.json" onChange={event=>{const file=event.target.files?.[0];if(file)void file.text().then(text=>importBundle(JSON.parse(text))).then(result=>{setNotice(`Imported ${result.importedAttempts} attempts and ${result.importedProfiles} profiles; duplicates skipped.`);return refresh();}).catch(error=>setNotice(`Import rejected: ${String(error)}`));event.target.value='';}}/></label></div>
        <div className="progress-table"><table><thead><tr><th>Completed</th><th>Trainee / level</th><th>Mode</th><th>Seed</th><th>Score</th><th>Eligibility</th><th>Review</th></tr></thead><tbody>{selected.map(attempt=><tr key={attempt.id}><td>{attempt.completedAt.slice(0,16).replace('T',' ')}</td><td>{profiles.find(profile=>profile.id===attempt.profileId)?.name??'Legacy trainee'} / {attempt.level??'—'}</td><td>{attempt.mode}</td><td>{attempt.seed}</td><td>{attempt.level===0?'Diagnostic':attempt.state.review?Math.round(attempt.state.review.overall):'—'}</td><td>{attempt.status==='interrupted'?'Interrupted':attempt.eligibilityFlags?.length?attempt.eligibilityFlags.join(', '):attempt.mode==='assessment'?'Thresholds evaluated':'Practice / legacy'}</td><td><a href={appBase(location.pathname)+'aar/'+encodeURIComponent(attempt.id)}>Open AAR ↗</a></td></tr>)}</tbody></table>{!selected.length&&<p>No attempts for these filters yet.</p>}</div>
      </section>
    </div>
  </main>;
}
