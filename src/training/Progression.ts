import type { ExerciseArchive } from './AttemptStore';

export type TrainingMode = 'guided' | 'practice' | 'assessment' | 'demo';
export type TrainingLevel = 0 | 1 | 2 | 3 | 4;

export interface TrainingProfile {
  id: string;
  name: string;
  createdAt: string;
}

const NEXT_LEVEL: Partial<Record<TrainingLevel, TrainingLevel>> = { 1: 2, 2: 3, 3: 4 };
const EXCLUDED_FLAGS = new Set(['interrupted', 'aborted', 'instructorModified', 'instructor-modified', 'demo', 'legacy']);

function isCompleted(record: ExerciseArchive): boolean {
  if (record.status === 'interrupted' || record.status === 'legacy') return false;
  return Boolean(record.state.review) && (record.status === undefined || record.status === 'completed');
}

function isEligibleAssessment(record: ExerciseArchive, profileId: string, level: TrainingLevel, rubricVersion: string): boolean {
  if (record.profileId !== profileId || record.level !== level || record.rubricVersion !== rubricVersion) return false;
  if (record.mode !== 'assessment' || !isCompleted(record)) return false;
  if (!Number.isInteger(record.seed) || record.eligibilityFlags?.some(flag => EXCLUDED_FLAGS.has(flag))) return false;

  const review = record.state.review;
  if (!review || review.criticalDecisionError || review.overall < 80) return false;
  const { detection, classification, threatAssessment, decisionQuality } = review.scores;
  return detection >= 60 && classification >= 60 && threatAssessment >= 60 && decisionQuality >= 60;
}

function progressionForVersion(attempts: readonly ExerciseArchive[], profileId: string, rubricVersion: string): TrainingLevel {
  // Level 0 is familiarisation; progression assessments begin at level 1.
  let current: TrainingLevel = 1;
  while (current < 4) {
    const byAttemptId = new Map<string, ExerciseArchive>();
    for (const attempt of attempts) {
      if (!isEligibleAssessment(attempt, profileId, current, rubricVersion)) continue;
      const previous = byAttemptId.get(attempt.id);
      if (!previous || attempt.completedAt > previous.completedAt) byAttemptId.set(attempt.id, attempt);
    }
    const seeds = new Set([...byAttemptId.values()].map(attempt => attempt.seed));
    if (seeds.size < 2) break;
    current = NEXT_LEVEL[current]!;
  }
  return current;
}

/**
 * Returns the highest unlocked level for a profile. Level 0 is familiarisation;
 * each of levels 1–3 requires two completed assessment attempts at that level,
 * with different seeds, meeting every score threshold. Attempts from different
 * rubric versions are never combined. By default the latest profile rubric is
 * used; supply `rubricVersion` to select one explicitly.
 */
export function unlockedLevel(
  attempts: readonly ExerciseArchive[],
  profileId: string,
  rubricVersion?: string,
): TrainingLevel {
  const latestVersion = rubricVersion ?? attempts
    .filter(attempt => attempt.profileId === profileId && Boolean(attempt.rubricVersion))
    .slice().sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0]?.rubricVersion;
  return latestVersion ? progressionForVersion(attempts, profileId, latestVersion) : 1;
}
