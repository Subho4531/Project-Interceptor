import type { Classification, ResponseChoice, TrainingState } from '../simulation/types';

export const classifications: {id:Classification;label:string}[] = [{id:'benign',label:'Benign / permitted'},{id:'unknown',label:'Unknown'},{id:'concern',label:'Potential concern'},{id:'threat',label:'Simulated threat'}];
export const responses: {id:ResponseChoice;label:string}[] = [{id:'observe',label:'Continue observation'},{id:'information',label:'Request more information'},{id:'report',label:'Escalate / report'},{id:'simulated-response',label:'Request simulated response'}];
export const elapsed = (seconds:number) => { const rounded = Math.floor(seconds + 1e-7); return `${Math.floor(rounded/60).toString().padStart(2,'0')}:${(rounded%60).toString().padStart(2,'0')}`; };

export function Briefing({training}:{training:TrainingState}) {
  return <div className="scenario-briefing"><span className="eyebrow">{training.briefing.code} / TRAINING OBJECTIVES</span><ol>{training.briefing.objectives.map(objective => <li key={objective}>{objective}</li>)}</ol><small>Use E or Space with a contact in the reticle. C opens recorded reports. Assessment entry holds the simulation clock.</small></div>;
}

export function ContactPanel({training,selected,onSelect,onClassify,onRespond,onClose}:{training:TrainingState;selected:string;onSelect:(id:string)=>void;onClassify:(id:string,value:Classification)=>void;onRespond:(id:string,value:ResponseChoice)=>void;onClose:()=>void}) {
  const report = training.reports.find(r => r.id === selected) ?? training.reports.at(-1);
  return <section className="contact-panel" aria-label="Contact assessment"><span className="panel-index">OBSERVER / CONTACT REPORT</span><h2>Assess the contact.</h2>
    {!report ? <p>Acquire an aerial contact with the reticle and press E or Space. Reports will appear here.</p> : <>
      <label htmlFor="contact">Recorded contact</label><select id="contact" value={report.id} onChange={e => onSelect(e.target.value)}>{training.reports.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
      <div className="contact-bearing"><span>{elapsed(report.detectedAt)}</span><span>{Math.round(report.bearing).toString().padStart(3,'0')}° AZ</span><span>{report.elevation.toFixed(1)}° EL</span></div>
      <fieldset><legend>Classification</legend>{classifications.map(c => <label className="choice" key={c.id}><input type="radio" name="classification" checked={report.classification === c.id} onChange={() => onClassify(report.id,c.id)} /><span>{c.label}</span></label>)}</fieldset>
      <fieldset disabled={!report.classification}><legend>Response decision</legend>{responses.map(r => <label className="choice" key={r.id}><input type="radio" name="response" checked={report.response === r.id} onChange={() => onRespond(report.id,r.id)} /><span>{r.label}</span></label>)}</fieldset>
      <p className="report-note">{report.response ? 'Decision recorded. Continue scanning for other contacts.' : report.classification ? 'Select a response based on your assessment.' : 'Assess observed behaviour; the aircraft silhouette does not establish intent.'}</p>
      <small>Response choices record a decision only. Exercise guidance is illustrative.</small>
    </>}
    <button className="enter-button" onClick={onClose}>Return to observation →</button>
  </section>;
}

export function ExerciseResults({training,onReset,onChoose,onExport}:{training:TrainingState;onReset:()=>void;onChoose:()=>void;onExport:()=>void}) {
  const review = training.review!;
  return <section className="exercise-results" aria-label="Exercise review"><span className="panel-index">{training.briefing.code} / AFTER-ACTION REVIEW</span><h1>Observation review.</h1><p className="review-intro">{training.briefing.title} · {elapsed(review.elapsed)} · {review.reason === 'operator' ? 'Ended by trainee' : 'Exercise complete'}</p>
    <div className="review-metrics"><div><b>{review.detected}/{review.expected}</b><span>Contacts detected</span></div><div><b>{review.missed}</b><span>Contacts missed</span></div><div><b>{review.falseReports}</b><span>Unacquired reports</span></div><div><b>{review.zoneEntries}</b><span>Zone crossings</span></div></div>
    <div className="review-guidance"><span className="eyebrow">EXERCISE RUBRIC</span><p>{review.rationale}</p><small>Classification matches: {review.classificationMatches}/{review.expected}. Response matches: {review.responseMatches}/{review.expected}. This is an illustrative training rubric, not an operational SOP or certified score.</small></div>
    <div className="review-table"><table><caption>Your contact reports</caption><thead><tr><th>Contact / time</th><th>Classification</th><th>Response</th></tr></thead><tbody>{training.reports.map(r => <tr key={r.id}><td>{r.label}<small>{elapsed(r.detectedAt)} · {Math.round(r.bearing)}°</small></td><td>{classifications.find(c => c.id === r.classification)?.label ?? 'Not submitted'}</td><td>{responses.find(c => c.id === r.response)?.label ?? 'Not submitted'}</td></tr>)}</tbody></table>{training.reports.length === 0 && <p>No aerial contacts were recorded during this run.</p>}</div>
    <div className="review-actions"><button className="enter-button" onClick={onReset}>Repeat exercise →</button><button className="secondary-button" onClick={onChoose}>Choose another exercise</button><button className="secondary-button" onClick={onExport}>Export review JSON</button></div>
  </section>;
}
