import { describe, expect, it } from 'vitest';
import type { SessionSnapshot } from './types';
import type { ExerciseState, ExerciseTrack } from '../training/Exercise';
import { buildGuideContext, deriveStage, localGuide, requestModelGuide } from './commanderGuide';

const baseSnapshot = (over: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  mode: 'preview', sessionId: 's-1', postId: 'shakti-punjab', scenarioId: 'low-ingress',
  status: 'running', time: 64, duration: 600, quietPeriod: 15, seed: 7, speed: 1,
  conditions: { timeOfDay: 'day', visibility: 'clear', weather: 'clear' },
  tracks: [], events: [], ...over,
});
const baseExercise = (over: Partial<ExerciseState> = {}): ExerciseState => ({
  status: 'running', time: 64, tracks: [], selectedEvidence: [], evidenceByContact: {},
  chronology: [], assessments: {}, actions: [], hypotheses: [], authorization: {},
  consequences: [], ...over,
});
const track = (over: Partial<ExerciseTrack>): ExerciseTrack => ({
  id: 'c-1', label: 'Contact 01', bearing: 42, rangeMeters: 1400, quality: 0.86,
  state: 'firm', firstEvidenceTime: 45, acknowledged: false, ...over,
});

describe('buildGuideContext', () => {
  it('excludes instructor truth fields from the model payload', () => {
    const snapshot = baseSnapshot({
      tracks: [{ id: 't-9', label: 'UAV 01', airframe: 'MQ-9 Reaper', state: 'active', position: [73, 26], altitudeAGL: 120, speed: 28, heading: 90, route: [[73, 26]], trail: [[73, 26]], spawnTime: 45 }],
    });
    const context = JSON.stringify(buildGuideContext(snapshot, baseExercise()));
    expect(context).not.toContain('airframe');
    expect(context).not.toContain('MQ-9');
    expect(context).not.toContain('route');
    expect(context).not.toContain('spawnTime');
  });

  it('carries only neutral delivered-evidence state', () => {
    const exercise = baseExercise({
      tracks: [track({ acknowledged: true, firstEvidenceTime: 45 })],
      evidenceByContact: { 'c-1': [{ id: 'e-1', source: 'rf', captureTime: 61, deliveryTime: 66, summary: 'Narrowband downlink heard.' }] },
    });
    const json = JSON.stringify(buildGuideContext(baseSnapshot(), exercise, 'low-ingress'));
    expect(json).toContain('Contact 01');
    expect(json).toContain('Narrowband downlink heard.');
    expect(json).toContain('"acknowledged":true');
  });
});

describe('deriveStage', () => {
  it('walks the workflow stages from neutral exercise state', () => {
    expect(deriveStage(baseSnapshot({ status: 'ready' }), baseExercise({ status: 'ready' })).stage).toBe('configure');
    expect(deriveStage(baseSnapshot(), baseExercise()).stage).toBe('watch');
    expect(deriveStage(baseSnapshot(), baseExercise({ tracks: [track({})] })).stage).toBe('contact');
    expect(deriveStage(baseSnapshot(), baseExercise({ tracks: [track({ acknowledged: true })], selectedContactId: 'c-1' })).stage).toBe('investigate');
    expect(deriveStage(baseSnapshot(), baseExercise({
      tracks: [track({ acknowledged: true })], selectedContactId: 'c-1',
      evidenceByContact: { 'c-1': [{ id: 'e-1', source: 'rf', captureTime: 61, deliveryTime: 66, summary: 'a' }, { id: 'e-2', source: 'eo', captureTime: 62, deliveryTime: 66, summary: 'b' }] },
    })).stage).toBe('assess');
    expect(deriveStage(baseSnapshot(), baseExercise({
      tracks: [track({ acknowledged: true })], selectedContactId: 'c-1',
      assessments: { 'c-1': { objectType: 'uav', coordination: 'single', affiliation: 'unconfirmed', threat: 'medium' } },
    })).stage).toBe('respond');
    expect(deriveStage(baseSnapshot({ status: 'completed' }), baseExercise({ status: 'completed', review: { scores: { detection: 0, classification: 0, threatAssessment: 0, decisionQuality: 0 }, overall: 0, criticalDecisionError: false, reasons: { detection: '', classification: '', threatAssessment: '', decisionQuality: '' }, chronology: [], summary: '', groundTruth: { objectType: 'uav', coordination: 'single', affiliation: 'unconfirmed', threat: 'low', contacts: [] } } })).stage).toBe('review');
  });
});

describe('localGuide', () => {
  it('narrates each stage without inventing data', () => {
    const context = buildGuideContext(baseSnapshot(), baseExercise({ tracks: [track({})] }));
    for (const stage of ['configure', 'watch', 'contact', 'investigate', 'assess', 'respond', 'review'] as const) {
      expect(localGuide(stage, context).length).toBeGreaterThan(20);
    }
    expect(localGuide('contact', context)).toContain('Contact 01');
    expect(localGuide('respond', context)).toContain('authorization');
  });
});

describe('requestModelGuide', () => {
  it('returns null instead of throwing when the proxy is unreachable', async () => {
    const result = await requestModelGuide(buildGuideContext(baseSnapshot(), baseExercise()), 'status?', 1500);
    expect(result).toBeNull();
  });
});
