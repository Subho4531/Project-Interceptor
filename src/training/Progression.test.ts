import { describe, expect, it } from 'vitest';
import type { ExerciseArchive } from './AttemptStore';
import { unlockedLevel } from './Progression';

const passingReview = {
  scores: { detection: 60, classification: 60, threatAssessment: 60, decisionQuality: 60 },
  overall: 80,
  criticalDecisionError: false,
  reasons: { detection: '', classification: '', threatAssessment: '', decisionQuality: '' },
  chronology: [], summary: 'Review.',
  groundTruth: { objectType: 'uav' as const, coordination: 'single' as const, affiliation: 'unauthorized' as const, threat: 'medium' as const, contacts: [] },
};

function attempt(seed: number, level: 0 | 1 | 2 | 3 | 4 = 1, overrides: Partial<ExerciseArchive> = {}): ExerciseArchive {
  const state: ExerciseArchive['state'] = {
    status: 'completed', time: 30, tracks: [], selectedEvidence: [], evidenceByContact: {}, chronology: [],
    assessments: {}, actions: [], hypotheses: [], authorization: {}, consequences: [], review: structuredClone(passingReview),
  };
  return {
    version: 1, id: `attempt-${level}-${seed}`, postId: 'shakti-punjab', scenarioId: 'low-ingress', seed,
    completedAt: `2026-01-${String(Math.min(seed, 28)).padStart(2, '0')}T00:00:00.000Z`,
    mode: 'assessment', status: 'completed', profileId: 'profile-1', level, rubricVersion: 'rubric-a', state,
    ...overrides,
  };
}

describe('unlockedLevel', () => {
  it('starts at level 1 and requires two distinct passing seeds at each assessed level', () => {
    expect(unlockedLevel([], 'profile-1')).toBe(1);
    const levelOne = [attempt(101), attempt(202)];
    expect(unlockedLevel(levelOne, 'profile-1')).toBe(2);
    expect(unlockedLevel([...levelOne, attempt(303, 2)], 'profile-1')).toBe(2);
    const levelTwo = [...levelOne, attempt(303, 2), attempt(404, 2)];
    expect(unlockedLevel(levelTwo, 'profile-1')).toBe(3);
    expect(unlockedLevel([...levelTwo, attempt(505, 3), attempt(606, 3)], 'profile-1')).toBe(4);
  });

  it('does not count repeat seeds or combine attempts from different rubric versions', () => {
    expect(unlockedLevel([attempt(11), attempt(11)], 'profile-1')).toBe(1);
    const duplicateId = attempt(22);
    duplicateId.id = attempt(11).id;
    expect(unlockedLevel([attempt(11), duplicateId], 'profile-1')).toBe(1);
    expect(unlockedLevel([
      attempt(11, 1, { rubricVersion: 'rubric-a' }),
      attempt(22, 1, { rubricVersion: 'rubric-b' }),
    ], 'profile-1')).toBe(1);
    expect(unlockedLevel([attempt(11), attempt(22)], 'profile-1', 'rubric-b')).toBe(1);
  });

  it('excludes non-assessment, interrupted, modified, demo, legacy and profile-mismatched attempts', () => {
    const excluded = [
      attempt(11, 1, { mode: 'practice' }), attempt(12, 1, { status: 'interrupted' }),
      attempt(13, 1, { eligibilityFlags: ['instructorModified'] }),
      attempt(14, 1, { eligibilityFlags: ['instructor-modified'] }),
      attempt(15, 1, { eligibilityFlags: ['demo'] }), attempt(16, 1, { eligibilityFlags: ['aborted'] }),
      attempt(17, 1, { status: 'legacy' }), attempt(18, 1, { mode: 'demo' }),
      attempt(19, 1, { profileId: 'other-profile' }),
      attempt(20, 1, { rubricVersion: undefined }), attempt(21, 1, { profileId: undefined }),
    ];
    expect(unlockedLevel(excluded, 'profile-1')).toBe(1);
  });

  it('requires overall 80, every component at least 60, and no critical error', () => {
    const lowOverall = attempt(11);
    lowOverall.state.review!.overall = 79.99;
    const lowComponent = attempt(12);
    lowComponent.state.review!.scores.decisionQuality = 59.99;
    const critical = attempt(13);
    critical.state.review!.criticalDecisionError = true;
    expect(unlockedLevel([lowOverall, lowComponent, critical], 'profile-1')).toBe(1);
  });
});
