import { describe, expect, it } from 'vitest';
import type { ExerciseArchive, TrainingBundle } from './AttemptStore';
import { validateTrainingBundle } from './AttemptStore';

function state(status: 'ready' | 'running' | 'completed' = 'completed', review?: ExerciseArchive['state']['review']): ExerciseArchive['state'] {
  return {
    status, time: 10, tracks: [], selectedEvidence: [], evidenceByContact: {}, chronology: [], assessments: {},
    actions: [], hypotheses: [], authorization: {}, consequences: [], review,
  };
}

function archive(id: string, completedAt: string, status: ExerciseArchive['status'] = 'completed'): ExerciseArchive {
  const hasReview = status === 'completed';
  return {
    version: 1, id, postId: 'shakti-punjab', scenarioId: 'low-ingress', seed: 22, completedAt, mode: 'practice',
    status, state: state(hasReview ? 'completed' : 'running', hasReview ? {
      scores: { detection: 100, classification: 100, threatAssessment: 100, decisionQuality: 100 }, overall: 100,
      criticalDecisionError: false,
      reasons: { detection: '', classification: '', threatAssessment: '', decisionQuality: '' },
      chronology: [], summary: 'Review.',
      groundTruth: { objectType: 'uav', coordination: 'single', affiliation: 'unauthorized', threat: 'medium', contacts: [] },
    } : undefined),
    profileId: 'profile-1', level: 1, rubricVersion: 'rubric-a',
  };
}

function bundle(profiles: unknown[], attempts: unknown[]): TrainingBundle {
  return {
    format: 'project-interceptor-training', version: 1, exportedAt: '2026-05-01T00:00:00.000Z',
    profiles: profiles as TrainingBundle['profiles'], attempts: attempts as TrainingBundle['attempts'],
  };
}

describe('training archive bundles', () => {
  it('accepts completed v1 archives and preserves optional progression metadata', () => {
    const record = archive('a1', '2026-04-01T00:00:00.000Z');
    record.eligibilityFlags = ['assessment'];
    const validated = validateTrainingBundle(bundle([{ id: 'profile-1', name: 'Operator One', createdAt: '2026-01-01T00:00:00.000Z' }], [record]));
    expect(validated.version).toBe(1);
    expect(validated.attempts[0]).toMatchObject({ profileId: 'profile-1', level: 1, rubricVersion: 'rubric-a', status: 'completed' });
  });

  it('accepts explicit interrupted archives and deduplicated checkpoints without a completed review', () => {
    const interrupted = archive('interrupted-1', '2026-04-01T00:00:00.000Z', 'interrupted');
    interrupted.checkpoints = [
      { time: 8, state: state('running') }, { time: 4, state: state('running') }, { time: 8, state: state('running') },
    ];
    const validated = validateTrainingBundle(bundle([], [interrupted]));
    expect(validated.attempts[0].status).toBe('interrupted');
    expect(validated.attempts[0].state.review).toBeUndefined();
    expect(validated.attempts[0].checkpoints?.map(checkpoint => checkpoint.time)).toEqual([4, 8]);
  });

  it('requires an explicit interrupted or legacy status when the review is missing', () => {
    const incomplete = archive('incomplete', '2026-04-01T00:00:00.000Z', 'interrupted');
    delete incomplete.status;
    expect(() => validateTrainingBundle(bundle([], [incomplete]))).toThrow(/without a completed review/);
  });

  it('deduplicates profiles and attempts by stable ID, keeping the most recent record', () => {
    const older = archive('same-attempt', '2026-04-01T00:00:00.000Z');
    const newer = archive('same-attempt', '2026-04-02T00:00:00.000Z');
    const validated = validateTrainingBundle(bundle([
      { id: 'p1', name: 'Old Name', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'p1', name: 'New Name', createdAt: '2026-02-01T00:00:00.000Z' },
    ], [older, newer]));
    expect(validated.profiles).toHaveLength(1);
    expect(validated.profiles[0].name).toBe('New Name');
    expect(validated.attempts).toHaveLength(1);
    expect(validated.attempts[0].completedAt).toBe('2026-04-02T00:00:00.000Z');
  });

  it('accepts JSON text and rejects unknown bundle versions and invalid records', () => {
    const valid = bundle([], [archive('a1', '2026-04-01T00:00:00.000Z')]);
    expect(validateTrainingBundle(JSON.stringify(valid)).attempts).toHaveLength(1);
    expect(() => validateTrainingBundle({ ...valid, version: 2 })).toThrow(/format or version/);
    expect(() => validateTrainingBundle(bundle([], [{ ...archive('a1', '2026-04-01T00:00:00.000Z'), level: 7 }]))).toThrow(/invalid training level/);
    expect(() => validateTrainingBundle('{bad json')).toThrow(/valid JSON/);
  });

  it('rejects malformed nested evidence and score payloads before import', () => {
    const record = archive('malformed', '2026-04-01T00:00:00.000Z');
    const invalidScore=structuredClone(record);
    invalidScore.state.review!.scores.detection=NaN;
    expect(()=>validateTrainingBundle(bundle([], [invalidScore]))).toThrow();
    const invalidEvidence=structuredClone(record) as unknown as {state:{selectedEvidence:unknown[]}};
    invalidEvidence.state.selectedEvidence=[{id:'fake',deliveryTime:'tomorrow'}];
    expect(()=>validateTrainingBundle(bundle([], [invalidEvidence]))).toThrow();
    const privateDraft={...archive('draft','2026-04-01T00:00:00.000Z','interrupted'),resolvedRecipe:{version:1}};
    expect(()=>validateTrainingBundle(bundle([], [privateDraft]))).toThrow(/recipe/);
  });
});
