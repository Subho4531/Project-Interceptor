import type { ExerciseState } from './Exercise';
import type { PostId } from '../dashboard/types';

export interface ExerciseArchive {
  version: 1;
  id: string;
  postId: PostId;
  scenarioId: string;
  seed: number;
  completedAt: string;
  mode: 'practice';
  state: ExerciseState;
}

const DATABASE = 'project-interceptor-training';
const STORE = 'attempts';

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

export async function saveAttempt(record: ExerciseArchive): Promise<void> {
  if (!record.id || !record.state.review || !Number.isInteger(record.seed)) throw new Error('Completed attempt is invalid.');
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(structuredClone(record));
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
