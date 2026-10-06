import { describe, expect, it } from 'vitest';
import type { SensorObservation, SensorTrack } from '../simulation/SensorEngine';
import { ExerciseEngine } from './Exercise';

function radarTrack(id = 'radar-secret-track-42', entityId = 'secret-entity-42'): SensorTrack {
  return {
    id, sensorId: 'radar', entityId, label: 'Track secret-entity-42',
    position: { x: 120, y: 38, z: 220 }, time: 0, bearing: 28.6, elevation: 8.2,
    state: 'acquiring', quality: 0.6, age: 0, detections: 1, missed: 0,
  };
}

function eoObservation(entityId = 'secret-entity-42'): SensorObservation {
  return {
    id: 'eo-secret-entity-42', sensorId: 'eo', entityId,
    position: { x: 120, y: 38, z: 220 }, time: 0, bearing: 28.6, elevation: 8.2,
  };
}

function waitForCue(engine: ExerciseEngine, radar = radarTrack(), eo: SensorObservation[] = []): { id: string; time: number } {
  for (let time = 0; time <= 8; time += 0.25) {
    engine.tick(time, [radar], eo);
    const track = engine.state().tracks[0];
    if (track) return { id: track.id, time: engine.state().time };
  }
  throw new Error('The seeded radar cue was not delivered.');
}

function advanceUntil(
  engine: ExerciseEngine,
  predicate: (state: ReturnType<ExerciseEngine['state']>) => boolean,
  radar = radarTrack(),
  eo: SensorObservation[] = [],
): void {
  let time = engine.state().time;
  for (let count = 0; count < 40 && !predicate(engine.state()); count += 1) {
    time += 0.25;
    engine.tick(time, [radar], eo);
  }
}

describe('ExerciseEngine', () => {
  it('starts scored detection latency at first delivered cue, not hidden sensor time', () => {
    const engine = new ExerciseEngine({ seed: 19 });
    const radar = radarTrack();
    engine.tick(0, [radar], []);
    expect(engine.state().status).toBe('running');
    expect(engine.state().tracks).toHaveLength(0);

    const cue = waitForCue(engine, radar);
    expect(cue.time).toBeGreaterThan(0);
    engine.tick(cue.time + 4, [radar], []);
    expect(engine.act({ type: 'acknowledge-track', contactId: cue.id })).toBe(true);
    engine.act({ type: 'finish' });

    expect(engine.state().review?.detectionLatencySeconds).toBe(4);
    expect(engine.state().review?.scores.detection).toBe(100);
    expect(engine.state().review?.chronology.find(event => event.type === 'cue-delivered')?.time).toBe(cue.time);
  });

  it('keeps sensor entity identifiers and labels out of trainee state and AAR', () => {
    const engine = new ExerciseEngine({ seed: 5 });
    const radar = radarTrack('radar-top-secret-01', 'ground-truth-entity-01');
    const cue = waitForCue(engine, radar);
    engine.act({ type: 'acknowledge-track', contactId: cue.id });
    expect(engine.state().review).toBeUndefined();
    expect(JSON.stringify(engine.state())).not.toContain('groundTruth');
    engine.act({ type: 'finish' });

    const projection = JSON.stringify(engine.state());
    expect(projection).not.toContain('ground-truth-entity-01');
    expect(projection).not.toContain('radar-top-secret-01');
    expect(projection).not.toContain('secret-entity-42');
    expect(engine.state().tracks[0].id).toBe('C-01');
    expect(engine.state().tracks[0].label).toBe('Contact C-01');
    expect(engine.state().review?.groundTruth.objectType).toBe('uav');
  });

  it('repeats the same cue timing and state for the same seed and actions', () => {
    const run = () => {
      const engine = new ExerciseEngine({ seed: 2026 });
      const radar = radarTrack();
      const cue = waitForCue(engine, radar);
      engine.act({ type: 'acknowledge-track', contactId: cue.id });
      engine.act({ type: 'request-rf', contactId: cue.id });
      advanceUntil(engine, state => state.selectedEvidence.some(item => item.source === 'rf'), radar);
      engine.act({ type: 'finish' });
      return engine.state();
    };
    expect(run()).toEqual(run());
  });

  it('records actions without pausing or owning the shared simulation clock', () => {
    const engine = new ExerciseEngine({ seed: 8 });
    const radar = radarTrack();
    const cue = waitForCue(engine, radar);
    const before = engine.state().time;

    expect(engine.act({ type: 'verification', contactId: cue.id })).toBe(true);
    expect(engine.state().status).toBe('running');
    expect(engine.state().time).toBe(before);
    engine.tick(before + 1, [radar], []);
    expect(engine.state().status).toBe('running');
    expect(engine.state().time).toBe(before + 1);
  });

  it('accepts an abstract response only after command grants authorization', () => {
    const engine = new ExerciseEngine({ seed: 44 });
    const radar = radarTrack();
    const cue = waitForCue(engine, radar);
    expect(engine.act({ type: 'authorization', contactId: cue.id })).toBe(true);
    expect(engine.state().authorization[cue.id]).toBe('pending');

    advanceUntil(engine, state => state.authorization[cue.id] === 'granted', radar);
    expect(engine.state().authorization[cue.id]).toBe('granted');
    const responseTime = engine.state().time;
    expect(engine.act({ type: 'authorized-response', contactId: cue.id })).toBe(true);
    expect(engine.state().consequences).toHaveLength(0);
    engine.tick(responseTime + 2.9, [radar], []);
    expect(engine.state().consequences).toHaveLength(0);
    engine.tick(responseTime + 3, [radar], []);
    expect(engine.state().consequences).toHaveLength(1);
    expect(engine.state().consequences[0]).toMatchObject({
      contactId: cue.id, type: 'authorized-response', outcome: 'response-team-tasked',
    });
    expect(engine.state().tracks).toHaveLength(1);
    engine.tick(responseTime + 3, [radar], []);
    engine.tick(responseTime + 6, [radar], []);
    expect(engine.state().consequences).toHaveLength(1);
    expect(engine.state().review).toBeUndefined();
    engine.act({ type: 'finish' });

    expect(engine.state().actions.find(action => action.type === 'authorized-response')?.outcome).toBe('accepted');
    expect(engine.state().review?.criticalDecisionError).toBe(false);
    expect(engine.state().review?.chronology.filter(event => event.type === 'consequence-observed')).toHaveLength(1);
  });

  it('does not create a cue for a newly received lost radar track', () => {
    const engine = new ExerciseEngine({ seed: 17 });
    const lost = { ...radarTrack('radar-lost-only', 'lost-entity'), state: 'lost' as const };
    for (let time = 0; time <= 4; time += 0.25) engine.tick(time, [lost], []);
    expect(engine.state().tracks).toHaveLength(0);
    expect(engine.state().selectedContactId).toBeUndefined();
    expect(engine.state().actions).toHaveLength(0);
  });

  it('scores detection, classification, threat and decision quality with the 25/30/20/25 weights', () => {
    const engine = new ExerciseEngine({ seed: 303 });
    const radar = radarTrack();
    const eo = eoObservation();
    const cue = waitForCue(engine, radar, [eo]);
    engine.act({ type: 'acknowledge-track', contactId: cue.id });
    engine.act({ type: 'request-eo', contactId: cue.id });
    engine.act({ type: 'request-roster', contactId: cue.id });
    advanceUntil(engine, state =>
      state.selectedEvidence.some(item => item.source === 'eo') &&
      state.selectedEvidence.some(item => item.source === 'roster'),
    radar, [eo]);

    engine.act({ type: 'set-object-type', contactId: cue.id, value: 'uav' });
    engine.act({ type: 'set-coordination', contactId: cue.id, value: 'single' });
    engine.act({ type: 'set-affiliation', contactId: cue.id, value: 'unauthorized' });
    engine.act({ type: 'set-threat', contactId: cue.id, value: 'medium' });
    engine.act({ type: 'report', contactId: cue.id });
    engine.act({ type: 'finish' });

    expect(engine.state().review?.scores).toEqual({
      detection: 100, classification: 100, threatAssessment: 100, decisionQuality: 100,
    });
    expect(engine.state().review?.overall).toBe(100);
  });

  it('records an unapproved response attempt as a critical decision error', () => {
    const engine = new ExerciseEngine({ seed: 11 });
    const cue = waitForCue(engine);
    expect(engine.act({ type: 'authorized-response', contactId: cue.id })).toBe(true);
    engine.act({ type: 'finish' });
    expect(engine.state().review?.criticalDecisionError).toBe(true);
    expect(engine.state().review?.scores.decisionQuality).toBe(0);
  });
});
