import { useState } from 'react';
import type { CommandResult } from './types';
import type { ExerciseAction, ExerciseState } from '../training/Exercise';

const optionSets = {
  objectType: [['unknown', 'Unknown'], ['uav', 'UAV'], ['non-uav', 'Non-UAV']],
  coordination: [['unknown', 'Unknown'], ['single', 'Single'], ['multiple-independent', 'Multiple independent'], ['coordinated', 'Coordinated group']],
  affiliation: [['unconfirmed', 'Unconfirmed'], ['friendly', 'Authorized / friendly'], ['unauthorized', 'Confirmed unauthorized']],
  threat: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['critical', 'Critical']],
} as const;
const assessmentActions = {
  objectType: 'set-object-type',
  coordination: 'set-coordination',
  affiliation: 'set-affiliation',
  threat: 'set-threat',
} as const;
const decisions = [
  ['verification', 'Request verification'],
  ['monitor', 'Continue monitoring'],
  ['alert', 'Raise local alert'],
  ['report', 'Report to command'],
  ['authorization', 'Request authorization'],
  ['authorized-response', 'Task simulated response'],
] as const;

type Props = { exercise: ExerciseState; running: boolean; onAction: (action: ExerciseAction) => CommandResult };
const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`;

export default function AssessRespond({ exercise, running, onAction }: Props) {
  const [selectedId, setSelectedId] = useState<string>();
  const [feedback, setFeedback] = useState('');
  const selected = exercise.tracks.find(track => track.id === selectedId)
    ?? exercise.tracks.find(track => track.id === exercise.selectedContactId)
    ?? exercise.tracks[0];
  const assessment = selected ? exercise.assessments[selected.id] ?? {} : {};
  const evidence = selected ? exercise.evidenceByContact[selected.id] ?? [] : [];
  const authorization = selected? exercise.authorization[selected.id] : undefined;
  const consequence = exercise.consequences.at(-1);
  function run(action: ExerciseAction) {
    const result = onAction(action);
    setFeedback(result.message);
    return result;
  }
  function assess(key: keyof typeof optionSets, value: string) {
    if (!selected) return;
    run({ type: assessmentActions[key], contactId: selected.id, value } as ExerciseAction);
  }
  const heading = <div className="panel-heading"><span className="dash-kicker">ASSESS & RESPOND</span><span>{selected?.label ?? 'NO CONTACT'}</span></div>;
  if (exercise.status === 'ready' || !exercise.tracks.length) {
    return <section className="assess-respond">{heading}<p className="ar-empty">Assessment controls arm once the exercise is running{exercise.status === 'ready' ? ' — START it from the command bar' : ''}. Sensor cue delivery follows the shared clock.</p></section>;
  }
  return <section className="assess-respond" aria-label="Assess and respond controls">
    {heading}
    <div className="ar-contact-row">
      <select aria-label="Assessment contact" value={selected?.id ?? ''} onChange={event => setSelectedId(event.target.value)}>
        {exercise.tracks.map(track => <option key={track.id} value={track.id}>{track.label}{track.acknowledged ? ' · acknowledged' : ''}</option>)}
      </select>
      {selected && <span className={`ar-badge ${authorization ?? 'unset'}`}>{authorization ? `AUTH ${authorization.toUpperCase()}` : 'NO AUTH'}</span>}
    </div>
    {selected && <>
      <div className="ar-values">
        <span>BEARING<b>{Math.round(selected.bearing).toString().padStart(3, '0')}°</b></span>
        <span>RANGE<b>{(selected.rangeMeters / 1000).toFixed(2)} km</b></span>
        <span>QUALITY<b>{Math.round(selected.quality * 100)}%</b></span>
      </div>
      <button disabled={!running || selected.acknowledged} onClick={() => run({ type: 'acknowledge-track', contactId: selected.id })}>{selected.acknowledged ? 'Track acknowledged' : 'Acknowledge track'}</button>
      {selected.acknowledged ? <>
        <div className="ar-requests">
          {([['request-eo', 'Cue EO / thermal'], ['request-rf', 'Check RF'], ['request-roster', 'Flight roster'], ['request-history', 'Movement history']] as const).map(([type, label]) =>
            <button key={type} disabled={!running} onClick={() => run({ type, contactId: selected.id } as ExerciseAction)}>{label}</button>)}
        </div>
        <ol className="ar-evidence">
          {evidence.length
            ? evidence.map(item => <li key={item.id}><time>{clock(item.deliveryTime)}</time> <b>{item.source.toUpperCase()}</b> <span>{item.summary}</span></li>)
            : <li><span>Acknowledgement logged. Request evidence before assessing.</span></li>}
        </ol>
        <div className="ar-assessment">
          {(Object.keys(optionSets) as (keyof typeof optionSets)[]).map(key =>
            <label key={key}><span>{key === 'objectType' ? 'OBJECT TYPE' : key === 'coordination' ? 'COORDINATION' : key === 'affiliation' ? 'AFFILIATION' : 'THREAT'}</span>
              <select value={assessment[key] ?? ''} disabled={!running} onChange={event => assess(key, event.target.value)}>
                <option value="">Select</option>{optionSets[key].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></label>)}
        </div>
        <div className="ar-decisions">
          {decisions.map(([type, label]) => <button key={type} disabled={!running} onClick={() => run({ type, contactId: selected.id } as ExerciseAction)}>{label}</button>)}
        </div>
        <small className="ar-note">Decisions are high-level simulated commands recorded with the shared session clock. Authorization precedes any simulated response.</small>
      </> : <p className="ar-empty">Acknowledge this neutral track to open its investigation record.</p>}
      {feedback && <small className="ar-feedback">{feedback}</small>}
      {consequence && <div className="ar-consequence"><b>SIMULATED OUTCOME</b> {consequence.summary}</div>}
      <ol className="ar-chronology">{exercise.chronology.slice(-3).reverse().map(event => <li key={event.id}><time>{clock(event.time)}</time> {event.type.replaceAll('-', ' ')} — {event.detail}</li>)}</ol>
    </>}
  </section>;
}
