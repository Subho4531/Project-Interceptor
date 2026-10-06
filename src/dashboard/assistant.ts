import { postById } from './posts';
import type { AssistantReply, SelectedObject, SessionSnapshot } from './types';

export function answerAssistant(input:string,snapshot:SessionSnapshot,selected:SelectedObject,audience:'instructor'|'trainee'='instructor'):AssistantReply {
  const question=input.toLowerCase().trim(),post=postById(snapshot.postId),preview=snapshot.mode==='preview';
  const time=Math.floor(snapshot.time/60).toString().padStart(2,'0')+':'+Math.floor(snapshot.time%60).toString().padStart(2,'0');
  const prefix='['+(preview?'Preview':audience==='trainee'?'Trainee observation':'Instructor session')+' · '+time+'] ';
  const scope=preview?'preview':'session';
  if(audience==='trainee'&&/\b(identity|airframe|model|expected|answer|rubric|route|scheduled|hostile)\b/.test(question)&&snapshot.status!=='completed') return {text:prefix+'Assess the contact from your observations. Airframe identities, authored routes and the exercise rubric are held until review.'};
  if(/^(please\s+)?(reset|restart)\b/.test(question)) return {text:prefix+'Reset this '+scope+'? This clears its clock, reports and event timeline.',command:{type:'reset'},confirmation:true};
  const target=/\bmaru\b/.test(question)?'maru-rajasthan':/\bhimadri\b/.test(question)?'himadri-sikkim':/\bshakti\b/.test(question)?'shakti-punjab':undefined;
  if(target&&/^(please\s+)?(select|switch|change|open)\b/.test(question)) return {text:prefix+'Switch to '+postById(target).name+'? This starts a fresh '+scope+'.',command:{type:'post',postId:target},confirmation:true};
  if(/^(please\s+)?(pause|hold)\b/.test(question)) return {text:'Requested: pause '+scope+'.',command:{type:'pause'}};
  if(/^(please\s+)?(resume|continue)\b/.test(question)) return {text:'Requested: resume '+scope+'.',command:{type:'resume'}};
  if(/^(please\s+)?(start|begin)\b/.test(question)) return {text:'Requested: start '+scope+'.',command:{type:'start'}};
  if(/^(please\s+)?(finish|end)\b/.test(question)) return {text:prefix+'Finish this run?',command:{type:'finish'},confirmation:true};
  if(/^(please\s+)?(set|switch|change)\b.*\bnight\b|^night$/.test(question)) return {text:'Requested: night conditions.',command:{type:'conditions',conditions:{...snapshot.conditions,timeOfDay:'night'}}};
  if(/^(please\s+)?(set|switch|change)\b.*\bday(light)?\b|^day(light)?$/.test(question)) return {text:'Requested: daylight conditions.',command:{type:'conditions',conditions:{...snapshot.conditions,timeOfDay:'day'}}};
  if(/\b(radar|sensor|mask|eo)\b/.test(question)) {
    const tracks=snapshot.sensorTracks??[],firm=tracks.filter(t=>t.state==='firm').length,coasting=tracks.filter(t=>t.state==='coasting').length;
    if(selected.type==='sensor-track') {const t=tracks.find(t=>t.id===selected.id);if(t)return {text:prefix+t.label+': '+t.state+', report age '+t.age.toFixed(1)+' s, simulated track quality '+Math.round(t.quality*100)+'%. Range and terrain/structure masking govern reports; track quality does not classify intent.'};}
    return {text:prefix+firm+' firm radar tracks, '+coasting+' coasting, '+(snapshot.eoObservations?.length??0)+' recorded EO observations. Radar updates at 1 Hz with a 2.2 km limit and terrain/structure masking. EO uses manual bearing, elevation and zoom. These are fictional training parameters.'};
  }
  if(/\b(last|latest)\b.*\bevent\b|\bexplain\b/.test(question)) {
    const event=audience==='trainee'?snapshot.events.filter(e=>['observation','contact-detection','classification-submitted','response-selected','session-pause','session-resume','conditions-change'].includes(e.type)).at(-1):snapshot.events.at(-1);
    return {text:prefix+(event?event.message+' Source: '+event.source+'.':'No accessible events recorded.')};
  }
  if(/\b(selected|contact|track|uav)\b/.test(question)) {
    if(audience==='trainee') {const reports=snapshot.training?.reports??[];return {text:prefix+reports.length+' submitted contact reports. '+(reports.at(-1)?'Latest report: '+reports.at(-1)!.label+'. Classification: '+(reports.at(-1)!.classification??'not submitted')+'.':'No visual contact has been reported.')};}
    const numeric=question.match(/(?:uav|contact|track)\s*0?(\d+)/)?.[1];
    const track=numeric?snapshot.tracks[Number(numeric)-1]:snapshot.tracks.find(t=>selected.type==='track'&&t.id===selected.id);
    if(track) return {text:prefix+track.label+': '+track.state+', '+track.airframe+', '+track.altitudeAGL.toFixed(1)+' m AGL, '+track.speed+' m/s. '+(preview?'Fixture':'Instructor truth')+' position '+track.position[1].toFixed(5)+' N, '+track.position[0].toFixed(5)+' E.',focus:{type:'track',id:track.id}};
    return {text:prefix+snapshot.tracks.filter(t=>t.state==='active').length+' active, '+snapshot.tracks.filter(t=>t.state==='scheduled').length+' scheduled, '+snapshot.tracks.filter(t=>t.state==='departed').length+' departed contacts. Select a track for details.'};
  }
  if(/\b(post|region|location|summar|brief|status)\b/.test(question)) return {text:prefix+post.name+' Training Post, '+post.region+', '+post.state+'. '+post.terrain+'. '+scope+' '+snapshot.status+'; '+(audience==='trainee'?(snapshot.training?.reports.length??0)+' submitted reports':snapshot.tracks.filter(t=>t.state==='active').length+' active contacts')+'; '+snapshot.conditions.timeOfDay+', '+snapshot.conditions.visibility+' visibility. Fictional compound at a rounded regional anchor.'+(snapshot.error?' Asset dependency: '+snapshot.error:'')};
  return {text:prefix+'I can summarise this post, report radar status, show a selected contact, explain the last recorded event, or start/pause/resume/reset the session. Answers use recorded '+scope+' data; commands return their actual validation result.'};
}

