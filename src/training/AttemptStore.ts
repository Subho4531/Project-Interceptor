import type { ExerciseState } from './Exercise';
import type { PostId } from '../dashboard/types';
import type { TrainingLevel, TrainingMode, TrainingProfile } from './Progression';
import type { ResolvedExerciseRecipe } from './ResolvedRecipe';

export type { TrainingLevel, TrainingMode, TrainingProfile } from './Progression';

export type AttemptStatus = 'completed' | 'interrupted' | 'legacy';
export interface ExerciseCheckpoint {
  time: number;
  state: ExerciseState;
}

export interface ExerciseArchive {
  /** Archive schema remains v1; new metadata fields are optional for old records. */
  version: 1;
  id: string;
  postId: PostId;
  scenarioId: string;
  seed: number;
  completedAt: string;
  mode: TrainingMode;
  state: ExerciseState;
  status?: AttemptStatus;
  profileId?: string;
  level?: TrainingLevel;
  rubricVersion?: string;
  eligibilityFlags?: string[];
  checkpoints?: ExerciseCheckpoint[];
  inputMode?: 'desktop' | 'vr';
  inputModeTransitions?: {time:number;mode:'desktop'|'vr'}[];
  resolvedRecipe?: ResolvedExerciseRecipe;
}

export interface TrainingBundle {
  format: 'project-interceptor-training';
  version: 1;
  exportedAt: string;
  profiles: TrainingProfile[];
  attempts: ExerciseArchive[];
}

export interface BundleImportResult {
  importedProfiles: number;
  importedAttempts: number;
  skippedProfiles: number;
  skippedAttempts: number;
}

const DATABASE = 'project-interceptor-training';
const STORE = 'attempts';
// Keep the existing attempts database at version 1 for compatibility. Profiles
// live in a separate local database, so no IndexedDB upgrade is needed.
const PROFILE_DATABASE = 'project-interceptor-training-profiles';
const PROFILE_STORE = 'profiles';
const POST_IDS: readonly PostId[] = ['shakti-punjab', 'maru-rajasthan', 'himadri-sikkim'];
const TRAINING_MODES: readonly TrainingMode[] = ['guided', 'practice', 'assessment', 'demo'];
const ATTEMPT_STATUSES: readonly AttemptStatus[] = ['completed', 'interrupted', 'legacy'];

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Browser storage is unavailable.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('completedAt', 'completedAt');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open training history.'));
  });
}

function openProfileDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Browser storage is unavailable.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PROFILE_DATABASE, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROFILE_STORE)) db.createObjectStore(PROFILE_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open training profiles.'));
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function validateProfile(value: unknown): TrainingProfile {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim() || value.id.length > 128 ||
      typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80 || !isIsoDate(value.createdAt)) {
    throw new Error('Training bundle contains an invalid profile.');
  }
  return { id: value.id.trim(), name: value.name.trim(), createdAt: value.createdAt };
}

function validateExerciseState(value: unknown): value is ExerciseState {
  if (!isRecord(value) || !['ready', 'running', 'completed'].includes(String(value.status)) ||
      typeof value.time !== 'number' || !Number.isFinite(value.time) || value.time < 0 ||
      !Array.isArray(value.tracks) || !Array.isArray(value.actions) || !Array.isArray(value.selectedEvidence) || !isRecord(value.assessments)) return false;
  const timed=(item:unknown)=>isRecord(item)&&typeof item.id==='string'&&typeof item.time==='number'&&Number.isFinite(item.time)&&item.time>=0;
  const evidence=(item:unknown)=>isRecord(item)&&typeof item.id==='string'&&['radar','eo','rf','roster','history','authorization'].includes(String(item.source))&&typeof item.summary==='string'&&typeof item.captureTime==='number'&&Number.isFinite(item.captureTime)&&typeof item.deliveryTime==='number'&&Number.isFinite(item.deliveryTime)&&item.captureTime>=0&&item.deliveryTime>=item.captureTime;
  if(value.tracks.some(item=>!isRecord(item)||typeof item.id!=='string'||typeof item.label!=='string'||typeof item.bearing!=='number'||!Number.isFinite(item.bearing)||typeof item.rangeMeters!=='number'||!Number.isFinite(item.rangeMeters)||item.rangeMeters<0))return false;
  if(value.actions.some(item=>!timed(item)||!isRecord(item)||typeof item.summary!=='string'||typeof item.type!=='string'))return false;
  if(value.selectedEvidence.some(item=>!evidence(item)))return false;
  if(value.evidenceByContact!==undefined&&(!isRecord(value.evidenceByContact)||Object.values(value.evidenceByContact).some(items=>!Array.isArray(items)||items.some(item=>!evidence(item)))))return false;
  if(value.chronology!==undefined&&(!Array.isArray(value.chronology)||value.chronology.some(item=>!timed(item)||!isRecord(item)||typeof item.detail!=='string'||typeof item.type!=='string')))return false;
  return true;
}

function validateReview(value: unknown): boolean {
  const scores = isRecord(value) ? value.scores : undefined;
  if (!isRecord(value) || typeof value.overall !== 'number' || !Number.isFinite(value.overall) ||
      value.overall < 0 || value.overall > 100 || typeof value.criticalDecisionError !== 'boolean' || !isRecord(scores)) return false;
  if(!isRecord(value.reasons)||!Array.isArray(value.chronology)||!isRecord(value.groundTruth)||typeof value.summary!=='string')return false;
  const truth=value.groundTruth;
  const reasons=value.reasons;
  if(!['uav','non-uav','unknown'].includes(String(truth.objectType))||!['single','multiple-independent','coordinated','unknown'].includes(String(truth.coordination))||!['friendly','unauthorized','unconfirmed'].includes(String(truth.affiliation))||!['low','medium','high','critical'].includes(String(truth.threat)))return false;
  return ['detection', 'classification', 'threatAssessment', 'decisionQuality'].every(key =>typeof reasons[key]==='string'&&
    typeof scores[key] === 'number' && Number.isFinite(scores[key]) && Number(scores[key]) >= 0 && Number(scores[key]) <= 100);
}

function validateArchive(value: unknown): ExerciseArchive {
  if (!isRecord(value) || value.version !== 1 || typeof value.id !== 'string' || !value.id.trim() ||
      typeof value.postId !== 'string' || !POST_IDS.includes(value.postId as PostId) || typeof value.scenarioId !== 'string' || !value.scenarioId.trim() ||
      !Number.isInteger(value.seed) || Number(value.seed)<0 || Number(value.seed)>2147483647 || !isIsoDate(value.completedAt) ||
      !TRAINING_MODES.includes(value.mode as TrainingMode) || !validateExerciseState(value.state)) {
    throw new Error('Training bundle contains an invalid exercise archive.');
  }
  const state = value.state as ExerciseState;
  const status = value.status;
  if (status !== undefined && !ATTEMPT_STATUSES.includes(status as AttemptStatus)) throw new Error('Training bundle contains an invalid archive status.');
  if (state.review !== undefined && !validateReview(state.review)) throw new Error('Training bundle contains an invalid completed review.');
  if (status !== 'interrupted' && status !== 'legacy' && !state.review) {
    throw new Error('An archive without a completed review must have interrupted or legacy status.');
  }
  if (value.profileId !== undefined && (typeof value.profileId !== 'string' || !value.profileId.trim() || value.profileId.length > 128)) throw new Error('Training bundle contains an invalid profile reference.');
  if (value.rubricVersion !== undefined && (typeof value.rubricVersion !== 'string' || !value.rubricVersion.trim() || value.rubricVersion.length > 80)) throw new Error('Training bundle contains an invalid rubric version.');
  if (value.level !== undefined && (!Number.isInteger(value.level) || Number(value.level) < 0 || Number(value.level) > 4)) throw new Error('Training bundle contains an invalid training level.');
  if(value.inputMode!==undefined&&!['desktop','vr'].includes(String(value.inputMode)))throw new Error('Training bundle contains an invalid input mode.');
  if(value.inputModeTransitions!==undefined&&(!Array.isArray(value.inputModeTransitions)||value.inputModeTransitions.some(item=>!isRecord(item)||typeof item.time!=='number'||!Number.isFinite(item.time)||item.time<0||!['desktop','vr'].includes(String(item.mode)))))throw new Error('Invalid input mode history.');
  if(value.resolvedRecipe!==undefined){
    const recipe=value.resolvedRecipe;
    if(!state.review||!isRecord(recipe)||recipe.version!==1||!['rural','semi-urban'].includes(String(recipe.setting))||!isRecord(recipe.generation)||!isRecord(recipe.scenario)||!isRecord(recipe.sensorHealth))throw new Error('Invalid completed scenario recipe.');
    const scenario=recipe.scenario;
    if(!Number.isInteger(scenario.seed)||scenario.seed!==value.seed||!Number.isFinite(scenario.quietPeriod)||!Array.isArray(scenario.entities)||scenario.entities.some(entity=>!isRecord(entity)||typeof entity.id!=='string'||typeof entity.assetId!=='string'||!Number.isFinite(entity.speed)||!Number.isFinite(entity.spawnTime)||!Array.isArray(entity.route)||entity.route.some(point=>!isRecord(point)||!['x','y','z'].every(axis=>typeof point[axis]==='number'&&Number.isFinite(point[axis])))))throw new Error('Invalid resolved scenario routes.');
    if(recipe.generation.resolvedSeed!==value.seed||!Number.isInteger(recipe.generation.requestedSeed)||!Number.isInteger(recipe.generation.retries)||typeof recipe.generation.fallbackUsed!=='boolean')throw new Error('Invalid scenario generation metadata.');
  }
  if (value.eligibilityFlags !== undefined && (!Array.isArray(value.eligibilityFlags) || value.eligibilityFlags.some(flag => typeof flag !== 'string' || !flag.trim()))) {
    throw new Error('Training bundle contains invalid eligibility flags.');
  }
  if (value.checkpoints !== undefined && (!Array.isArray(value.checkpoints) || value.checkpoints.some(checkpoint =>
    !isRecord(checkpoint) || typeof checkpoint.time !== 'number' || !Number.isFinite(checkpoint.time) || checkpoint.time < 0 || !validateExerciseState(checkpoint.state)))) {
    throw new Error('Training bundle contains an invalid checkpoint.');
  }
  const archive = structuredClone(value) as unknown as ExerciseArchive;
  if (archive.eligibilityFlags) archive.eligibilityFlags = [...new Set(archive.eligibilityFlags.map(flag => flag.trim()))];
  if (archive.checkpoints) {
    const byTime = new Map<number, ExerciseCheckpoint>();
    for (const checkpoint of archive.checkpoints) byTime.set(checkpoint.time, checkpoint);
    archive.checkpoints = [...byTime.values()].sort((left, right) => left.time - right.time);
  }
  return archive;
}

function dedupeProfiles(profiles: TrainingProfile[]): TrainingProfile[] {
  const byId = new Map<string, TrainingProfile>();
  for (const profile of profiles) {
    const current = byId.get(profile.id);
    if (!current || profile.createdAt > current.createdAt) byId.set(profile.id, profile);
  }
  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

function dedupeAttempts(attempts: ExerciseArchive[]): ExerciseArchive[] {
  const byId = new Map<string, ExerciseArchive>();
  for (const attempt of attempts) {
    const current = byId.get(attempt.id);
    if (!current || attempt.completedAt > current.completedAt) byId.set(attempt.id, attempt);
  }
  return [...byId.values()].sort((left, right) => right.completedAt.localeCompare(left.completedAt) || left.id.localeCompare(right.id));
}

/** Validate and normalize a parsed object or JSON string before importing it. */
export function validateTrainingBundle(input: unknown): TrainingBundle {
  let value = input;
  if (typeof input === 'string') {
    try { value = JSON.parse(input) as unknown; }
    catch { throw new Error('Training bundle is not valid JSON.'); }
  }
  if (!isRecord(value) || value.format !== 'project-interceptor-training' || value.version !== 1 ||
      !isIsoDate(value.exportedAt) || !Array.isArray(value.profiles) || !Array.isArray(value.attempts)) {
    throw new Error('Training bundle format or version is not supported.');
  }
  return {
    format: 'project-interceptor-training', version: 1, exportedAt: value.exportedAt,
    profiles: dedupeProfiles(value.profiles.map(validateProfile)),
    attempts: dedupeAttempts(value.attempts.map(validateArchive)),
  };
}

export async function saveAttempt(record: ExerciseArchive): Promise<void> {
  const valid = validateArchive(record);
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(structuredClone(valid));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save training history.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Training history save was interrupted.'));
    });
  } finally { db.close(); }
}

export async function getAttempt(id: string): Promise<ExerciseArchive | undefined> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      request.onsuccess = () => resolve(request.result as ExerciseArchive | undefined);
      request.onerror = () => reject(request.error ?? new Error('Could not read training history.'));
    });
  } finally { db.close(); }
}

export async function listAttempts(): Promise<ExerciseArchive[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result as ExerciseArchive[]).sort((a, b) => b.completedAt.localeCompare(a.completedAt)));
      request.onerror = () => reject(request.error ?? new Error('Could not list training history.'));
    });
  } finally { db.close(); }
}

export async function saveProfile(profile: TrainingProfile): Promise<void> {
  const valid = validateProfile(profile);
  const db = await openProfileDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(PROFILE_STORE, 'readwrite');
      transaction.objectStore(PROFILE_STORE).put(valid);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save training profile.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Training profile save was interrupted.'));
    });
  } finally { db.close(); }
}

export async function listProfiles(): Promise<TrainingProfile[]> {
  const db = await openProfileDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(PROFILE_STORE, 'readonly').objectStore(PROFILE_STORE).getAll();
      request.onsuccess = () => resolve(dedupeProfiles((request.result as TrainingProfile[]).map(validateProfile)));
      request.onerror = () => reject(request.error ?? new Error('Could not list training profiles.'));
    });
  } finally { db.close(); }
}

/** Build a portable, versioned snapshot of the local profiles and attempts. */
export async function exportBundle(): Promise<TrainingBundle> {
  return validateTrainingBundle({
    format: 'project-interceptor-training', version: 1, exportedAt: new Date().toISOString(),
    profiles: await listProfiles(), attempts: await listAttempts(),
  });
}

/** Import validates the whole bundle first and skips IDs already stored locally. */
export async function importBundle(input: unknown): Promise<BundleImportResult> {
  const bundle = validateTrainingBundle(input);
  const [existingProfiles, existingAttempts] = await Promise.all([listProfiles(), listAttempts()]);
  const profileIds = new Set(existingProfiles.map(profile => profile.id));
  const attemptIds = new Set(existingAttempts.map(attempt => attempt.id));
  const newProfiles = bundle.profiles.filter(profile => !profileIds.has(profile.id));
  const newAttempts = bundle.attempts.filter(attempt => !attemptIds.has(attempt.id));
  for (const profile of newProfiles) await saveProfile(profile);
  for (const attempt of newAttempts) await saveAttempt(attempt);
  return {
    importedProfiles: newProfiles.length, importedAttempts: newAttempts.length,
    skippedProfiles: bundle.profiles.length - newProfiles.length,
    skippedAttempts: bundle.attempts.length - newAttempts.length,
  };
}
