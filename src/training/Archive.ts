import type { SessionSnapshot } from '../dashboard/types';
import type { ExerciseState } from './Exercise';
import type { ExerciseArchive, ExerciseCheckpoint } from './AttemptStore';
import type { ResolvedExerciseRecipe } from './ResolvedRecipe';

export function archiveAttempt(session:SessionSnapshot,state:ExerciseState,checkpoints:ExerciseCheckpoint[]=[],recipe?:ResolvedExerciseRecipe):ExerciseArchive{
  const completed=Boolean(state.review&&session.status==='completed');
  const record:ExerciseArchive={version:1,id:session.sessionId,postId:session.postId,scenarioId:session.scenarioId,seed:session.seed,completedAt:new Date().toISOString(),mode:session.trainingMode??'practice',profileId:session.profileId??'local-default',level:session.level??1,rubricVersion:session.rubricVersion??'prototype-1',eligibilityFlags:[...new Set([...(session.eligibilityFlags??[]),...(!completed?['interrupted']:[])])],status:completed?'completed':'interrupted',state,checkpoints,inputMode:session.inputMode??'desktop',resolvedRecipe:completed?recipe:undefined};
  record.inputModeTransitions=structuredClone(session.inputModeTransitions??[{time:0,mode:session.inputMode??'desktop'}]);
  return record;
}
