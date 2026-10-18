import type { SessionSnapshot } from './types';
import type { ExerciseState } from '../training/Exercise';
import { postById } from './posts';

/** Stages the commander guide can narrate. Derived only from shared, delivered training state. */
export type GuideStage = 'configure' | 'watch' | 'contact' | 'investigate' | 'assess' | 'respond' | 'review';
export interface GuideStageInfo { stage: GuideStage; key: string; label: string }

const clock = (t: number) => `${Math.floor(t / 60).toString().padStart(2, '0')}:${Math.floor(t % 60).toString().padStart(2, '0')}`;

/** Derives the current commander-guidance stage from the neutral exercise state (no hidden truth). */
export function deriveStage(snapshot: SessionSnapshot, exercise: ExerciseState): GuideStageInfo {
  if (snapshot.status === 'completed' || exercise.status === 'completed') return { stage: 'review', key: 'review', label: 'REVIEW' };
  if (snapshot.status === 'ready') return { stage: 'configure', key: 'configure', label: 'CONFIGURE' };
  if (!exercise.tracks.length) return { stage: 'watch', key: 'watch', label: 'WATCH' };
  return stageFromFocus(exercise);
}

function stageFromFocus(exercise: ExerciseState): GuideStageInfo {
  const unacknowledged = exercise.tracks.find(track => !track.acknowledged);
  if (unacknowledged) return { stage: 'contact', key: `contact:${unacknowledged.label}`, label: 'NEW CONTACT' };
  const focus = exercise.tracks.find(track => track.id === exercise.selectedContactId) ?? exercise.tracks.find(track => track.acknowledged);
  if (!focus) return { stage: 'watch', key: 'watch', label: 'WATCH' };
  const evidence = exercise.evidenceByContact[focus.id]?.length ?? 0;
  const assessment = exercise.assessments[focus.id] ?? {};
  const incomplete = !assessment.objectType || !assessment.coordination || !assessment.affiliation || !assessment.threat;
  if (incomplete) {
    return evidence < 2
      ? { stage: 'investigate', key: `investigate:${focus.label}:${evidence}`, label: 'INVESTIGATE' }
      : { stage: 'assess', key: `assess:${focus.label}:${evidence}`, label: 'ASSESS' };
  }
  const authorization = exercise.authorization[focus.id] ?? 'none';
  return { stage: 'respond', key: `respond:${focus.label}:${authorization}`, label: 'DECIDE / RESPOND' };
}

/** Neutral, trainee-visible session state handed to the model. Deliberately excludes instructor truth:
 *  no airframes, authored routes, rubric, scheduled futures or simulation entity identifiers. */
export interface GuideContext {
  step: string;
  clock: string;
  sessionStatus: SessionSnapshot['status'];
  exerciseStatus: ExerciseState['status'];
  exerciseId: string;
  post: { name: string; region: string; state: string; terrain: string };
  conditions: { timeOfDay: string; visibility: string; weather: string };
  contacts: Array<{
    label: string; bearingDeg: number; rangeKm: number; qualityPct: number; state: string; acknowledged: boolean;
    evidence: Array<{ source: string; captured: string; delivered: string; summary: string }>;
    assessment: { objectType?: string; coordination?: string; affiliation?: string; threat?: string };
    authorization: string;
  }>;
  recentActions: string[];
  recentEvents: string[];
  consequences: string[];
  reviewSummary?: string;
}

export function buildGuideContext(snapshot: SessionSnapshot, exercise: ExerciseState, exerciseId = ''): GuideContext {
  return {
    step: deriveStage(snapshot, exercise).label,
    clock: clock(snapshot.time),
    sessionStatus: snapshot.status,
    exerciseStatus: exercise.status,
    exerciseId,
    post: {
      name: postById(snapshot.postId).name,
      region: postById(snapshot.postId).region,
      state: postById(snapshot.postId).state,
      terrain: postById(snapshot.postId).terrain,
    },
    conditions: {
      timeOfDay: snapshot.conditions.timeOfDay,
      visibility: snapshot.conditions.visibility,
      weather: snapshot.conditions.weather ?? 'clear',
    },
    contacts: exercise.tracks.map(track => ({
      label: track.label,
      bearingDeg: Math.round(track.bearing),
      rangeKm: Number((track.rangeMeters / 1000).toFixed(2)),
      qualityPct: Math.round(track.quality * 100),
      state: track.state,
      acknowledged: track.acknowledged,
      evidence: (exercise.evidenceByContact[track.id] ?? []).map(item => ({
        source: item.source,
        captured: clock(item.captureTime),
        delivered: clock(item.deliveryTime),
        summary: item.summary,
      })),
      assessment: exercise.assessments[track.id] ?? {},
      authorization: exercise.authorization[track.id] ?? 'none',
    })),
    recentActions: exercise.actions.slice(-6).map(record => `${record.summary}${record.outcome ? ` (${record.outcome})` : ''}`),
    recentEvents: exercise.chronology.slice(-6).map(event => `${clock(event.time)} ${event.type} — ${event.detail}`),
    consequences: exercise.consequences.map(consequence => consequence.summary),
    reviewSummary: exercise.review?.summary,
  };
}

/** Deterministic local script used when the model endpoint is unavailable, plus as the styled fallback. */
export function localGuide(stage: GuideStage, context: GuideContext): string {
  const lead = context.contacts[0];
  switch (stage) {
    case 'configure':
      return 'Commander, the exercise is configured on the curriculum page — this console runs it. Check the level chip, exercise identity and asset status in the top bar, then START when regional assets are ready. I will call out cues as they arrive.';
    case 'watch':
      return 'No qualifying returns on the wall. Maintain sweep discipline — sensor silence is not confirmation of clear airspace.';
    case 'contact':
      return (lead ? `New return: ${lead.label}, bearing ${lead.bearingDeg}°, ${lead.rangeKm} km. ` : '')
        + 'Transits cross the operation area once — acknowledge and assess before it reaches the far edge of the radar view, or this contact is scored as unobserved.';
    case 'investigate':
      return (lead ? `${lead.label} is acknowledged. ` : '')
        + 'Cue EO and RF, then compare capture time against delivery time before forming an assessment. One source is not a picture.';
    case 'assess':
      return (lead ? `Evidence is logged on ${lead.label}. ` : '')
        + 'Set object type, coordination, affiliation and threat as separate judgements. "Unknown" is a valid call when evidence is insufficient.';
    case 'respond':
      return (lead ? `Assessment recorded for ${lead.label}. ` : '')
        + 'If the threat warrants action, request authorization first — the simulated response is only tasked once it is granted.';
    case 'review':
      return 'Review is ready. Walk the chronology, compare it with the trainee record, then export the AAR. Note where evidence lagged behind decisions.';
  }
}

/** Requests commander guidance from the local model-guide proxy. Returns null when unavailable;
 *  {quota:true} when the model key is rate-limited, letting the caller explain the fallback. */
export async function requestModelGuide(context: GuideContext, question?: string, timeoutMs = 20000): Promise<{ text: string; quota: boolean } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch('/api/guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, question }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await response.json().catch(() => ({})) as { ok?: boolean; text?: string; quota?: boolean };
    if (data.ok && typeof data.text === 'string' && data.text.trim()) return { text: data.text, quota: false };
    return data.quota ? { text: '', quota: true } : null;
  } catch {
    return null;
  }
}
