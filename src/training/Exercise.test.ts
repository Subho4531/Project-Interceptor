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

function waitForCues(engine: ExerciseEngine, radar: SensorTrack[]): ReturnType<ExerciseEngine['state']>['tracks'] {
  for (let time = 0; time <= 12; time += 0.25) {
    engine.tick(time, radar, []);
    if (engine.state().tracks.length === radar.length) return engine.state().tracks;
  }
  throw new Error('The seeded radar cues were not all delivered.');
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

  it('keeps friendly truth hidden until review and scores a restrained friendly assessment', () => {
    const engine = new ExerciseEngine({ seed: 72, fixture: 'friendly' });
    const radar = radarTrack();
    const cue = waitForCue(engine, radar);
    engine.act({ type: 'acknowledge-track', contactId: cue.id });
    engine.act({ type: 'request-roster', contactId: cue.id });
    advanceUntil(engine, state => state.selectedEvidence.some(item => item.source === 'roster'), radar);
    engine.act({ type: 'set-object-type', contactId: cue.id, value: 'uav' });
    engine.act({ type: 'set-coordination', contactId: cue.id, value: 'single' });
    engine.act({ type: 'set-affiliation', contactId: cue.id, value: 'friendly' });
    engine.act({ type: 'set-threat', contactId: cue.id, value: 'low' });
    engine.act({ type: 'monitor', contactId: cue.id });

    expect(JSON.stringify(engine.state())).not.toContain('groundTruth');
    expect(engine.state().authorization).toEqual({});
    engine.act({ type: 'finish' });
    expect(engine.state().review?.groundTruth).toMatchObject({
      objectType: 'uav', coordination: 'single', affiliation: 'friendly', threat: 'low',
    });
    expect(engine.state().review?.scores).toEqual({
      detection: 100, classification: 100, threatAssessment: 100, decisionQuality: 100,
    });
  });

  it.each(['ambiguous', 'false-return'] as const)(
    'supports unknown or non-UAV assessments for the %s synthetic radar-only return', fixture => {
      const radar = radarTrack('radar-synthetic-return', 'private-synthetic-entity');
      const run = (objectType: 'unknown' | 'non-uav') => {
        const engine = new ExerciseEngine({ seed: 515, fixture });
        const cue = waitForCue(engine, radar);
        engine.act({ type: 'acknowledge-track', contactId: cue.id });
        engine.act({ type: 'request-eo', contactId: cue.id });
        engine.act({ type: 'request-history', contactId: cue.id });
        advanceUntil(engine, state =>
          state.selectedEvidence.some(item => item.source === 'history') &&
          state.selectedEvidence.some(item => item.source === 'eo'), radar);

        const duringExercise = JSON.stringify(engine.state());
        expect(duringExercise).not.toContain('groundTruth');
        expect(duringExercise).not.toContain('private-synthetic-entity');
        expect(engine.state().selectedEvidence.some(item => item.source === 'eo' && item.quality === 0)).toBe(true);
        expect(engine.state().hypotheses[0].label).toBe('Possible non-airborne return');

        engine.act({ type: 'set-object-type', contactId: cue.id, value: objectType });
        engine.act({ type: 'set-coordination', contactId: cue.id, value: 'single' });
        engine.act({ type: 'set-affiliation', contactId: cue.id, value: 'unconfirmed' });
        engine.act({ type: 'set-threat', contactId: cue.id, value: 'low' });
        engine.act({ type: 'report', contactId: cue.id });
        engine.act({ type: 'finish' });
        return engine.state();
      };

      for (const assessment of ['unknown', 'non-uav'] as const) {
        const result = run(assessment);
        expect(result.review?.groundTruth.objectType).toBe('non-uav');
        expect(result.review?.scores.classification).toBe(100);
        expect(result.review?.scores.threatAssessment).toBe(100);
      }
    },
  );

  it('scores coordinated contacts as one group objective from the first acknowledged lead', () => {
    const engine = new ExerciseEngine({ seed: 808, fixture: 'coordinated' });
    const radar = [radarTrack('radar-private-a', 'entity-private-a'), radarTrack('radar-private-b', 'entity-private-b')];
    radar[1] = { ...radar[1], position: { x: -180, y: 52, z: 260 }, bearing: 325 };
    const cues = waitForCues(engine, radar);
    const lead = cues.find(cue => cue.id === 'C-01')!;
    const other = cues.find(cue => cue.id !== lead.id)!;
    engine.act({ type: 'acknowledge-track', contactId: lead.id });
    engine.act({ type: 'acknowledge-track', contactId: other.id });
    engine.act({ type: 'request-history', contactId: lead.id });
    let time = engine.state().time;
    for (let count = 0; count < 60 && engine.state().actions.filter(action => action.type === 'request-history' && action.outcome === 'recorded').length < 1; count += 1) {
      time += 0.25;
      engine.tick(time, radar, []);
    }
    engine.act({ type: 'set-object-type', contactId: lead.id, value: 'uav' });
    engine.act({ type: 'set-coordination', contactId: lead.id, value: 'coordinated' });
    engine.act({ type: 'set-affiliation', contactId: lead.id, value: 'unauthorized' });
    engine.act({ type: 'set-threat', contactId: lead.id, value: 'high' });
    engine.act({ type: 'report', contactId: lead.id });
    expect(JSON.stringify(engine.state())).not.toContain('groundTruth');
    engine.act({ type: 'finish' });

    expect(engine.state().review?.groundTruth.contacts).toHaveLength(2);
    expect(engine.state().review?.groundTruth.contacts.every(contact => contact.coordination === 'coordinated')).toBe(true);
    expect(engine.state().review?.scores.detection).toBe(100);
    expect(engine.state().review?.scores.classification).toBe(100);
    expect(engine.state().review?.scores.threatAssessment).toBe(100);
    expect(engine.state().review?.scores.decisionQuality).toBe(100);
    expect(engine.state().actions.filter(action => action.type === 'report')).toEqual([
      expect.objectContaining({ contactId: lead.id }),
    ]);
    expect(engine.state().review?.reasons.classification).toContain('first acknowledged contact is the group lead');
  });

  it('assigns mixed contacts by stable neutral ordinal and returns evidence from each contact profile', () => {
    const engine = new ExerciseEngine({ seed: 190, fixture: 'mixed' });
    // The incoming order deliberately disagrees with sorted sensor-key order.
    const radar = [radarTrack('radar-z-private', 'private-z'), radarTrack('radar-a-private', 'private-a')];
    radar[1] = { ...radar[1], position: { x: -120, y: 45, z: 240 }, bearing: 333 };
    const cues = waitForCues(engine, radar);
    const first = cues.find(cue => cue.id === 'C-01')!;
    const second = cues.find(cue => cue.id === 'C-02')!;
    expect(engine.act({ type: 'request-roster', contactId: first.id })).toBe(true);
    expect(engine.act({ type: 'request-roster', contactId: second.id })).toBe(true);
    let time = engine.state().time;
    for (let count = 0; count < 60 && engine.state().actions.filter(action => action.type === 'request-roster' && action.outcome === 'recorded').length < 2; count += 1) {
      time += 0.25;
      engine.tick(time, radar, []);
    }
    expect(JSON.stringify(engine.state())).not.toContain('groundTruth');
    expect(JSON.stringify(engine.state())).not.toContain('private-a');
    expect(engine.state().evidenceByContact[first.id].some(item => item.summary.includes('matches this contact'))).toBe(true);
    expect(engine.state().evidenceByContact[second.id].some(item => item.summary.includes('marks this contact unauthorized'))).toBe(true);
    engine.act({ type: 'finish' });

    const contacts = engine.state().review?.groundTruth.contacts ?? [];
    expect(contacts.find(contact => contact.contactId === 'C-01')).toMatchObject({
      objectType: 'uav', coordination: 'multiple-independent', affiliation: 'friendly', threat: 'low',
    });
    expect(contacts.find(contact => contact.contactId === 'C-02')).toMatchObject({
      objectType: 'uav', coordination: 'multiple-independent', affiliation: 'unauthorized', threat: 'medium',
    });
  });

  it('resolves seeded fixtures, evidence timing and after-action truth reproducibly', () => {
    const run = () => {
      const engine = new ExerciseEngine({ seed: 90210, fixture: 'seeded' });
      const radar = radarTrack();
      const cue = waitForCue(engine, radar);
      engine.act({ type: 'request-history', contactId: cue.id });
      advanceUntil(engine, state => state.selectedEvidence.some(item => item.source === 'history'), radar);
      engine.act({ type: 'finish' });
      return engine.state();
    };
    expect(run()).toEqual(run());
  });
});
