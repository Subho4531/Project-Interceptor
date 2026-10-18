import type { SensorObservation, SensorTrack } from '../simulation/SensorEngine';

export type ExerciseStatus = 'ready' | 'running' | 'completed';
export type ExerciseObjectType = 'uav' | 'non-uav' | 'unknown';
export type ExerciseCoordination = 'single' | 'multiple-independent' | 'coordinated' | 'unknown';
export type ExerciseAffiliation = 'friendly' | 'unauthorized' | 'unconfirmed';
export type ExerciseThreat = 'low' | 'medium' | 'high' | 'critical';
export type ExerciseEvidenceSource = 'radar' | 'eo' | 'rf' | 'roster' | 'history' | 'authorization';
/** Authored sensor exercise profile. `seeded` selects one profile reproducibly. */
export type ExerciseFixtureId = 'basic' | 'friendly' | 'ambiguous' | 'false-return' | 'coordinated' | 'mixed' | 'seeded';

export interface ExerciseTruth {
  objectType: ExerciseObjectType;
  coordination: ExerciseCoordination;
  affiliation: ExerciseAffiliation;
  threat: ExerciseThreat;
}

export interface ExerciseTrack {
  /** Exercise-local neutral identifier. Never a sensor or simulation identifier. */
  id: string;
  label: string;
  bearing: number;
  rangeMeters: number;
  quality: number;
  state: SensorTrack['state'];
  firstEvidenceTime: number;
  acknowledged: boolean;
}

export interface ExerciseEvidence {
  id: string;
  source: ExerciseEvidenceSource;
  captureTime: number;
  deliveryTime: number;
  summary: string;
  quality?: number;
}

export interface ExerciseAssessment {
  objectType?: ExerciseObjectType;
  coordination?: ExerciseCoordination;
  affiliation?: ExerciseAffiliation;
  threat?: ExerciseThreat;
}

export interface AssistantHypothesis {
  contactId: string;
  label: string;
  confidence: 'low' | 'moderate' | 'high';
  basis: string;
}

export type ExerciseEventType =
  | 'cue-delivered' | 'acknowledged' | 'evidence-requested' | 'evidence-returned'
  | 'assessment-updated' | 'decision' | 'authorization-status' | 'consequence-observed' | 'contact-escaped' | 'exercise-finished';

export interface ExerciseEvent {
  id: string;
  time: number;
  type: ExerciseEventType;
  contactId?: string;
  detail: string;
}

export interface ExerciseConsequence {
  id: string;
  time: number;
  contactId: string;
  type: 'authorized-response';
  outcome: 'response-team-tasked';
  summary: string;
}

export type ExerciseAction =
  | { type: 'acknowledge-track'; contactId: string }
  | { type: 'request-eo' | 'request-rf' | 'request-roster' | 'request-history'; contactId: string }
  | { type: 'set-object-type'; contactId: string; value: ExerciseObjectType }
  | { type: 'set-coordination'; contactId: string; value: ExerciseCoordination }
  | { type: 'set-affiliation'; contactId: string; value: ExerciseAffiliation }
  | { type: 'set-threat'; contactId: string; value: ExerciseThreat }
  | { type: 'verification' | 'report' | 'alert' | 'authorization' | 'authorized-response' | 'monitor'; contactId?: string }
  | { type: 'finish' };

export interface ExerciseActionRecord {
  id: string;
  time: number;
  type: ExerciseAction['type'];
  contactId?: string;
  summary: string;
  outcome?: 'recorded' | 'pending' | 'granted' | 'denied' | 'accepted' | 'blocked';
}

export interface ExerciseReview {
  scores: { detection: number; classification: number; threatAssessment: number; decisionQuality: number };
  overall: number;
  detectionLatencySeconds?: number;
  criticalDecisionError: boolean;
  reasons: { detection: string; classification: string; threatAssessment: string; decisionQuality: string };
  chronology: ExerciseEvent[];
  summary: string;
  /** Kept at the root for existing review clients; contacts contains the full authored truth. */
  groundTruth: ExerciseTruth & { contacts: Array<{ contactId: string; escaped?: boolean } & ExerciseTruth> };
}

export interface ExerciseState {
  status: ExerciseStatus;
  time: number;
  tracks: ExerciseTrack[];
  selectedContactId?: string;
  selectedEvidence: ExerciseEvidence[];
  evidenceByContact: Record<string, ExerciseEvidence[]>;
  chronology: ExerciseEvent[];
  assessments: Record<string, ExerciseAssessment>;
  actions: ExerciseActionRecord[];
  hypotheses: AssistantHypothesis[];
  authorization: Record<string, 'pending' | 'granted' | 'denied'>;
  consequences: ExerciseConsequence[];
  review?: ExerciseReview;
}

export interface ExerciseEngineOptions {
  seed?: number;
  quietPeriod?: number;
  /** Test and authored-fixture hook; the default is Basic Detection. */
  fixture?: ExerciseFixtureId;
}

/** Entity ids whose transit route has ended (they left the operation area). */
export type DespawnedIds = ReadonlySet<string>;

type Fixture = Exclude<ExerciseFixtureId, 'seeded'>;
type RequestType = 'request-eo' | 'request-rf' | 'request-roster' | 'request-history';
type PendingTask =
  | { kind: 'radar-cue'; dueAt: number; sequence: number; contactId: string; sensorKey: string }
  | { kind: 'evidence'; dueAt: number; sequence: number; contactId: string; request: RequestType; entityId: string }
  | { kind: 'authorization'; dueAt: number; sequence: number; contactId: string }
  | { kind: 'consequence'; dueAt: number; sequence: number; contactId: string };
interface InternalContact {
  contactId: string;
  entityId: string;
  latestRadar: SensorTrack;
  firstEvidenceTime?: number;
  acknowledgedAt?: number;
  truth: ExerciseTruth;
  fixture: Fixture;
}

/**
 * A tick accepts SensorEngine-compatible radar projections. A training-only return
 * (for example, a false radar return) may be supplied as a synthetic SensorTrack;
 * use unique private sensor/entity IDs and omit an EO observation when it has no
 * visual correlate. Those IDs are never copied to the trainee projection.
 */
export type ExerciseRadarInput = SensorTrack;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const roundScore = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
function hashSeed(seed: number, key: string): number {
  let hash = seed | 0;
  for (let index = 0; index < key.length; index += 1) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  hash ^= hash << 13; hash ^= hash >>> 17; hash ^= hash << 5;
  return hash >>> 0;
}
const authoredFixtures: readonly Fixture[] = ['basic', 'friendly', 'ambiguous', 'coordinated'];
function resolveFixture(fixture: ExerciseFixtureId | undefined, seed: number): Fixture {
  if (!fixture || fixture === 'basic') return 'basic';
  if (fixture === 'seeded') return authoredFixtures[hashSeed(seed, 'exercise-fixture') % authoredFixtures.length];
  return fixture;
}
function truthFor(fixture: Fixture): ExerciseTruth {
  switch (fixture) {
    case 'friendly': return { objectType: 'uav', coordination: 'single', affiliation: 'friendly', threat: 'low' };
    case 'mixed': return { ...truthFor('friendly'), coordination: 'multiple-independent' };
    case 'ambiguous':
    case 'false-return': return { objectType: 'non-uav', coordination: 'single', affiliation: 'unconfirmed', threat: 'low' };
    case 'coordinated': return { objectType: 'uav', coordination: 'coordinated', affiliation: 'unauthorized', threat: 'high' };
    default: return { objectType: 'uav', coordination: 'single', affiliation: 'unauthorized', threat: 'medium' };
  }
}
function isRequest(type: ExerciseAction['type']): type is RequestType {
  return type === 'request-eo' || type === 'request-rf' || type === 'request-roster' || type === 'request-history';
}

/**
 * Deterministic trainee-facing exercise logic. Feed it the session clock and sensor
 * projections each frame; this class never schedules its own timer or pauses time.
 */
export class ExerciseEngine {
  private readonly seed: number;
  private readonly quietPeriod: number;
  private readonly fixture: Fixture;
  private currentTime = 0;
  private currentStatus: ExerciseStatus = 'ready';
  private contactSequence = 0;
  private evidenceSequence = 0;
  private actionSequence = 0;
  private eventSequence = 0;
  private taskSequence = 0;
  private consequenceSequence = 0;
  private readonly internalBySensorKey = new Map<string, InternalContact>();
  private readonly internalByContactId = new Map<string, InternalContact>();
  private readonly publicTracks = new Map<string, ExerciseTrack>();
  private readonly evidenceByContact = new Map<string, ExerciseEvidence[]>();
  private readonly assessments = new Map<string, ExerciseAssessment>();
  private readonly actions: ExerciseActionRecord[] = [];
  private readonly events: ExerciseEvent[] = [];
  private readonly consequences: ExerciseConsequence[] = [];
  private readonly pending: PendingTask[] = [];
  private readonly latestEOByEntity = new Map<string, SensorObservation>();
  private readonly authorizationByContact = new Map<string, 'pending' | 'granted' | 'denied'>();
  private readonly verificationContacts = new Set<string>();
  private readonly acknowledgementTimes = new Map<string, number>();
  /** Contacts that left the operation area without a trainee report. */
  private readonly escapedContacts = new Set<string>();
  private despawned: DespawnedIds = new Set<string>();
  private selectedContactId?: string;
  private criticalDecisionError = false;
  private review?: ExerciseReview;

  constructor(options: ExerciseEngineOptions = {}) {
    this.seed = Number.isFinite(options.seed) ? Math.trunc(options.seed!) : 26052;
    this.quietPeriod = Number.isFinite(options.quietPeriod) ? Math.max(0, options.quietPeriod!) : 0;
    this.fixture = resolveFixture(options.fixture, this.seed);
  }

  tick(time: number, radarTracks: ExerciseRadarInput[], eoObservations: SensorObservation[], despawned?: DespawnedIds): void {
    if (this.currentStatus === 'completed' || !Number.isFinite(time)) return;
    this.currentTime = Math.max(this.currentTime, Math.max(0, time));
    this.currentStatus = 'running';
    this.despawned = despawned ?? this.despawned;
    this.latestEOByEntity.clear();
    for (const observation of eoObservations) {
      if (observation.sensorId === 'eo') this.latestEOByEntity.set(observation.entityId, observation);
    }
    if (this.currentTime + 1e-9 >= this.quietPeriod) {
      const radar = radarTracks.filter(track => track.sensorId === 'radar').slice()
        .sort((left, right) => left.id.localeCompare(right.id));
      for (const track of radar) this.receiveRadarTrack(track);
    }
    this.deliverReadyTasks();
  }

  /** Return a cloned trainee-safe projection. Sensor/entity identifiers stay private. */
  state(): ExerciseState {
    const assessments: Record<string, ExerciseAssessment> = {};
    for (const [id, assessment] of this.assessments) assessments[id] = { ...assessment };
    const authorization: Record<string, 'pending' | 'granted' | 'denied'> = {};
    for (const [id, outcome] of this.authorizationByContact) authorization[id] = outcome;
    const selectedEvidence = this.selectedContactId
      ? (this.evidenceByContact.get(this.selectedContactId) ?? []).map(item => ({ ...item }))
      : [];
    const state: ExerciseState = {
      status: this.currentStatus,
      time: this.currentTime,
      tracks: [...this.publicTracks.values()].map(track => ({ ...track })),
      selectedContactId: this.selectedContactId,
      selectedEvidence,
      evidenceByContact: Object.fromEntries([...this.evidenceByContact].map(([id,items])=>[id,items.map(item=>({...item}))])),
      chronology: this.events.map(event=>({...event})),
      assessments,
      actions: this.actions.map(action => ({ ...action })),
      hypotheses: this.buildHypotheses(),
      authorization,
      consequences: this.consequences.map(consequence => ({ ...consequence })),
    };
    if (this.review) state.review = {
      ...this.review, scores: { ...this.review.scores }, reasons: { ...this.review.reasons },
      chronology: this.review.chronology.map(event => ({ ...event })),
      groundTruth: { ...this.review.groundTruth, contacts: this.review.groundTruth.contacts.map(contact => ({ ...contact })) },
    };
    return state;
  }

  /** Apply a trainee action at the current shared simulation time. */
  act(action: ExerciseAction): boolean {
    if (this.currentStatus === 'completed') return false;
    if (action.type === 'finish') { this.finish(); return true; }

    if (action.type === 'acknowledge-track') {
      const contact = this.getActionContact(action.contactId);
      if (!contact) return false;
      const track = this.publicTracks.get(contact.contactId)!;
      track.acknowledged = true;
      contact.acknowledgedAt ??= this.currentTime;
      this.acknowledgementTimes.set(contact.contactId, contact.acknowledgedAt);
      this.recordAction(action.type, contact.contactId, 'Neutral contact report acknowledged.', 'recorded');
      this.recordEvent('acknowledged', contact.contactId, 'The trainee acknowledged a displayed contact.');
      return true;
    }

    if (isRequest(action.type)) {
      const contact = this.getActionContact(action.contactId);
      if (!contact) return false;
      this.verificationContacts.add(contact.contactId);
      const actionId = this.recordAction(action.type, contact.contactId, 'Evidence request queued.', 'pending');
      this.recordEvent('evidence-requested', contact.contactId, 'A delayed evidence request was sent.');
      this.pending.push({
        kind: 'evidence', contactId: contact.contactId, entityId: contact.entityId, request: action.type,
        dueAt: this.currentTime + this.delayFor(actionId, action.type), sequence: ++this.taskSequence,
      });
      return true;
    }

    if (action.type === 'set-object-type' || action.type === 'set-coordination' || action.type === 'set-affiliation' || action.type === 'set-threat') {
      const contact = this.getActionContact(action.contactId);
      if (!contact || !this.isValidAssessment(action)) return false;
      const assessment = this.assessments.get(contact.contactId) ?? {};
      if (action.type === 'set-object-type') assessment.objectType = action.value;
      else if (action.type === 'set-coordination') assessment.coordination = action.value;
      else if (action.type === 'set-affiliation') assessment.affiliation = action.value;
      else assessment.threat = action.value;
      this.assessments.set(contact.contactId, assessment);
      this.recordAction(action.type, contact.contactId, `${action.type.replace('set-','')}: ${action.value}.`, 'recorded');
      this.recordEvent('assessment-updated', contact.contactId, `${action.type.replace('set-','')}: ${action.value}.`);
      return true;
    }

    if (action.type === 'verification') {
      const contact = this.getActionContact(action.contactId);
      if (contact) this.verificationContacts.add(contact.contactId);
      this.recordAction(action.type, contact?.contactId, 'Verification action recorded.', 'recorded');
      this.recordEvent('decision', contact?.contactId, 'The trainee requested verification.');
      return true;
    }

    if (action.type === 'authorization') {
      const contact = this.getActionContact(action.contactId);
      if (!contact) return false;
      this.authorizationByContact.set(contact.contactId, 'pending');
      const actionId = this.recordAction(action.type, contact.contactId, 'Authorization request sent to command.', 'pending');
      this.recordEvent('decision', contact.contactId, 'The trainee requested command authorization.');
      this.pending.push({
        kind: 'authorization', contactId: contact.contactId,
        dueAt: this.currentTime + this.delayFor(actionId, 'authorization'), sequence: ++this.taskSequence,
      });
      return true;
    }

    if (action.type === 'authorized-response') {
      const contact = this.getActionContact(action.contactId);
      if (!contact) return false;
      const authorized = this.authorizationByContact.get(contact.contactId) === 'granted';
      if (!authorized) {
        this.criticalDecisionError = true;
        this.recordAction(action.type, contact.contactId, 'Abstract response was not initiated because authorization was not granted.', 'blocked');
        this.recordEvent('decision', contact.contactId, 'An abstract response was blocked because command authorization was not granted.');
        return true;
      }
      this.recordAction(action.type, contact.contactId, 'Authorized abstract training response requested; no weapon controls are modeled.', 'accepted');
      this.recordEvent('decision', contact.contactId, 'The trainee requested an authorized abstract response.');
      this.pending.push({
        kind: 'consequence',
        contactId: contact.contactId,
        dueAt: this.currentTime + 3,
        sequence: ++this.taskSequence,
      });
      return true;
    }

    if (action.type === 'report' || action.type === 'alert' || action.type === 'monitor') {
      const contact = this.getActionContact(action.contactId);
      const summary = action.type === 'report' ? 'Contact reported to command.'
        : action.type === 'alert' ? 'Local alert raised.' : 'Contact placed under continued monitoring.';
      this.recordAction(action.type, contact?.contactId, summary, 'recorded');
      this.recordEvent('decision', contact?.contactId, summary);
      if (action.type === 'alert' && (this.fixture === 'friendly' || contact?.truth.affiliation === 'friendly')) this.criticalDecisionError = true;
      return true;
    }
    return false;
  }

  private receiveRadarTrack(track: SensorTrack): void {
    let contact = this.internalBySensorKey.get(track.id);
    if (!contact) {
      if (track.state === 'lost') return;
      const ordinal = ++this.contactSequence;
      const id = 'C-' + String(ordinal).padStart(2, '0');
      // Mixed contacts alternate on neutral sorted contact ordinal, never on a
      // simulation/entity identifier. A coordinated fixture shares one group truth.
      const fixture: Fixture = this.fixture === 'mixed' ? ordinal % 2 === 1 ? 'friendly' : 'basic' : this.fixture;
      const truth = truthFor(fixture);
      if (this.fixture === 'mixed') truth.coordination = 'multiple-independent';
      contact = { contactId: id, entityId: track.entityId, latestRadar: track, fixture, truth };
      this.internalBySensorKey.set(track.id, contact);
      this.internalByContactId.set(id, contact);
      this.assessments.set(id, {});
      this.evidenceByContact.set(id, []);
      this.pending.push({
        kind: 'radar-cue', contactId: id, sensorKey: track.id,
        dueAt: this.currentTime + this.delayFor(id, 'radar-cue'), sequence: ++this.taskSequence,
      });
      return;
    }
    contact.latestRadar = track;
    const view = this.publicTracks.get(contact.contactId);
    if (view) Object.assign(view, this.toPublicTrack(contact, view.firstEvidenceTime));
    // A transit contact that was never reported by the trainee and whose entity has
    // left the operation area is scored as unobserved. Stale coasting plots alone do
    // not escape a contact - terrain-masking can delay reporting for a live UAV.
    if (!this.escapedContacts.has(contact.contactId) && !this.acknowledgementTimes.has(contact.contactId)
      && (track.state === 'coasting' || track.state === 'lost') && this.despawned.has(contact.entityId)) {
      this.escapedContacts.add(contact.contactId);
      this.recordEvent('contact-escaped', contact.contactId,
        'The contact left the observation area without a trainee report; it is scored as unobserved.');
    }
  }

  private deliverReadyTasks(): void {
    const ready = this.pending.filter(task => task.dueAt <= this.currentTime + 1e-9)
      .sort((a, b) => a.dueAt - b.dueAt || a.sequence - b.sequence);
    if (!ready.length) return;
    const readySet = new Set(ready);
    for (let index = this.pending.length - 1; index >= 0; index -= 1) {
      if (readySet.has(this.pending[index])) this.pending.splice(index, 1);
    }
    for (const task of ready) {
      if (task.kind === 'radar-cue') this.deliverRadarCue(task);
      else if (task.kind === 'evidence') this.deliverEvidence(task);
      else if (task.kind === 'authorization') this.deliverAuthorization(task);
      else this.deliverConsequence(task);
    }
  }

  private deliverRadarCue(task: Extract<PendingTask, { kind: 'radar-cue' }>): void {
    const contact = this.internalBySensorKey.get(task.sensorKey);
    if (!contact || this.publicTracks.has(task.contactId)) return;
    const deliveredAt = this.currentTime;
    contact.firstEvidenceTime = deliveredAt;
    const view = this.toPublicTrack(contact, deliveredAt);
    this.publicTracks.set(contact.contactId, view);
    this.selectedContactId ??= contact.contactId;
    this.evidenceByContact.get(contact.contactId)!.push({
      id: 'E-' + String(++this.evidenceSequence).padStart(3, '0'),
      source: 'radar', captureTime: contact.latestRadar.time, deliveryTime: deliveredAt,
      summary: 'Radar reports an unclassified contact at bearing ' + Math.round(view.bearing) +
        '°, range ' + Math.round(view.rangeMeters) + ' m.',
      quality: view.quality,
    });
    this.recordEvent('cue-delivered', contact.contactId, 'First qualifying radar evidence was delivered to the trainee.');
  }

  private deliverEvidence(task: Extract<PendingTask, { kind: 'evidence' }>): void {
    if (!this.internalByContactId.has(task.contactId)) return;
    const observation = task.request === 'request-eo' ? this.latestEOByEntity.get(task.entityId) : undefined;
    let evidence: ExerciseEvidence;
    const contact = this.internalByContactId.get(task.contactId)!;
    if (task.request === 'request-eo') {
      evidence = observation ? {
        id: 'E-' + String(++this.evidenceSequence).padStart(3, '0'), source: 'eo',
        captureTime: observation.time, deliveryTime: this.currentTime,
        summary: contact.fixture === 'ambiguous'
          ? 'EO acquired a low-contrast visual return; the silhouette is insufficient to distinguish an airborne object from background clutter.'
          : 'EO acquired an unclassified visual contact. Object type and affiliation remain unconfirmed.',
        quality: contact.fixture === 'ambiguous' ? 0.3 : 0.65,
      } : {
        id: 'E-' + String(++this.evidenceSequence).padStart(3, '0'), source: 'eo',
        captureTime: this.currentTime, deliveryTime: this.currentTime,
        summary: contact.fixture === 'ambiguous' || contact.fixture === 'false-return'
          ? 'EO found no visual correlate for this radar return. A radar-only plot may be clutter; non-acquisition alone does not prove the object type.'
          : 'EO did not acquire the contact during this request; this does not establish that it is absent.', quality: 0,
      };
    } else {
      const summaries: Record<'request-rf' | 'request-roster' | 'request-history', string> = {
        'request-rf': contact.fixture === 'friendly'
          ? 'Fictional telemetry was detected; its source is consistent with authorized training activity.'
          : contact.fixture === 'coordinated'
            ? 'Several fictional RF signatures share a repeating timing pattern; this supports coordination but does not establish intent.'
            : contact.fixture === 'ambiguous' || contact.fixture === 'false-return'
              ? 'No coherent RF emission was detected. This does not establish whether the radar return is airborne or identify affiliation.'
              : 'RF returns were inconclusive and do not establish affiliation or intent.',
        'request-roster': contact.fixture === 'friendly'
          ? 'A fictional authorization record matches this contact and the current exercise window.'
          : contact.fixture === 'ambiguous' || contact.fixture === 'false-return'
            ? 'No fictional authorization record matches this return; the roster cannot identify radar clutter, and absence of a match does not establish unauthorized activity.'
            : 'A fictional roster record marks this contact unauthorized; this supports affiliation assessment but does not establish intent.',
        'request-history': contact.fixture === 'friendly'
          ? 'A similar contact appears in prior authorized exercise history.'
          : contact.fixture === 'coordinated'
            ? 'Multiple contacts show matched route timing and paired changes in direction. This supports coordination, not shared intent.'
            : contact.fixture === 'ambiguous' || contact.fixture === 'false-return'
              ? 'A fictional history comparison links this intermittent return to a stationary terrain reflection; no airborne correlate is confirmed.'
              : 'No prior correlated contact history was available for comparison.',
      };
      const source: ExerciseEvidenceSource = task.request === 'request-rf' ? 'rf' : task.request === 'request-roster' ? 'roster' : 'history';
      evidence = {
        id: 'E-' + String(++this.evidenceSequence).padStart(3, '0'), source,
        captureTime: this.currentTime, deliveryTime: this.currentTime,
        summary: summaries[task.request],
        quality: task.request === 'request-roster' && contact.fixture === 'friendly' ? 0.9
          : (contact.fixture === 'ambiguous' || contact.fixture === 'false-return') && task.request === 'request-history'
            ? (hashSeed(this.seed, `clue:${contact.contactId}`) % 2 ? 0.65 : 0.8)
            : task.request === 'request-history' && contact.fixture === 'coordinated' ? 0.85
              : task.request === 'request-roster' && contact.fixture !== 'ambiguous' && contact.fixture !== 'false-return' ? 0.9 : 0.5,
      };
    }
    this.evidenceByContact.get(task.contactId)!.push(evidence);
    const action = [...this.actions].reverse().find(item => item.type === task.request && item.contactId === task.contactId && item.outcome === 'pending');
    if (action) action.outcome = 'recorded';
    this.recordEvent('evidence-returned', task.contactId, evidence.summary);
  }

  private deliverAuthorization(task: Extract<PendingTask, { kind: 'authorization' }>): void {
    const contact = this.internalByContactId.get(task.contactId);
    const outcome = contact?.truth.objectType === 'uav' && contact.truth.affiliation === 'unauthorized' ? 'granted' : 'denied';
    this.authorizationByContact.set(task.contactId, outcome);
    const action = [...this.actions].reverse().find(item => item.type === 'authorization' && item.contactId === task.contactId && item.outcome === 'pending');
    if (action) {
      action.outcome = outcome;
      action.summary = outcome === 'granted'
        ? 'Command granted the requested abstract training authorization.'
        : 'Command denied the requested abstract training authorization.';
    }
    this.evidenceByContact.get(task.contactId)?.push({
      id: 'E-' + String(++this.evidenceSequence).padStart(3, '0'), source: 'authorization',
      captureTime: this.currentTime, deliveryTime: this.currentTime,
      summary: outcome === 'granted'
        ? 'Command authorization granted for an abstract training response.'
        : 'Command authorization denied; continue monitoring and reporting.',
    });
    this.recordEvent('authorization-status', task.contactId, 'Command returned an authorization decision: ' + outcome + '.');
  }

  private deliverConsequence(task: Extract<PendingTask, { kind: 'consequence' }>): void {
    const consequence: ExerciseConsequence = {
      id: 'CNS-' + String(++this.consequenceSequence).padStart(3, '0'),
      time: this.currentTime,
      contactId: task.contactId,
      type: 'authorized-response',
      outcome: 'response-team-tasked',
      summary: 'Command tasked a simulated response team. The contact remains under observation.',
    };
    this.consequences.push(consequence);
    this.recordEvent('consequence-observed', task.contactId, consequence.summary);
  }

  private toPublicTrack(contact: InternalContact, firstEvidenceTime: number): ExerciseTrack {
    const radar = contact.latestRadar;
    return {
      id: contact.contactId, label: 'Contact ' + contact.contactId,
      bearing: radar.bearing,
      rangeMeters: Math.hypot(radar.position.x, radar.position.y, radar.position.z),
      quality: clamp01(radar.quality), state: radar.state, firstEvidenceTime,
      acknowledged: this.publicTracks.get(contact.contactId)?.acknowledged ?? false,
    };
  }

  private getActionContact(contactId?: string): InternalContact | undefined {
    const selected = contactId ?? this.selectedContactId;
    if (!selected) return undefined;
    const contact = this.internalByContactId.get(selected);
    if (!contact || !this.publicTracks.has(selected)) return undefined;
    this.selectedContactId = selected;
    return contact;
  }

  private isValidAssessment(action: ExerciseAction): boolean {
    if (action.type === 'set-object-type') return ['uav', 'non-uav', 'unknown'].includes(action.value);
    if (action.type === 'set-coordination') return ['single', 'multiple-independent', 'coordinated', 'unknown'].includes(action.value);
    if (action.type === 'set-affiliation') return ['friendly', 'unauthorized', 'unconfirmed'].includes(action.value);
    if (action.type === 'set-threat') return ['low', 'medium', 'high', 'critical'].includes(action.value);
    return false;
  }

  private delayFor(key: string, kind: string): number {
    const fraction = hashSeed(this.seed, kind + ':' + key) / 0xffffffff;
    return (kind === 'radar-cue' ? 0.35 : 0.8) + fraction * (kind === 'radar-cue' ? 1.25 : 2.8);
  }

  private recordAction(type: ExerciseAction['type'], contactId: string | undefined, summary: string, outcome?: ExerciseActionRecord['outcome']): string {
    const id = 'A-' + String(++this.actionSequence).padStart(3, '0');
    const action: ExerciseActionRecord = { id, time: this.currentTime, type, summary, outcome };
    if (contactId) action.contactId = contactId;
    this.actions.push(action);
    return id;
  }

  private recordEvent(type: ExerciseEventType, contactId: string | undefined, detail: string): void {
    const event: ExerciseEvent = { id: 'EV-' + String(++this.eventSequence).padStart(3, '0'), time: this.currentTime, type, detail };
    if (contactId) event.contactId = contactId;
    this.events.push(event);
  }

  private buildHypotheses(): AssistantHypothesis[] {
    return [...this.publicTracks.values()].map(track => {
      const evidence = this.evidenceByContact.get(track.id) ?? [];
      const hasEO = evidence.some(item => item.source === 'eo' && item.quality && item.quality > 0);
      const roster = evidence.find(item => item.source === 'roster');
      if (roster?.summary.includes('matches this contact')) return {
        contactId: track.id, label: 'Likely authorized activity', confidence: 'moderate',
        basis: 'A fictional roster match is available; movement and object type still require assessment.',
      };
      if (roster?.summary.includes('marks this contact unauthorized')) return {
        contactId: track.id, label: 'Unconfirmed aerial activity', confidence: 'moderate',
        basis: 'A fictional roster result supports an unauthorized status; intent and threat remain separate questions.',
      };
      if (evidence.some(item => item.summary.includes('stationary terrain reflection'))) return {
        contactId: track.id, label: 'Possible non-airborne return', confidence: 'moderate',
        basis: 'A fictional history comparison links the intermittent radar return to a terrain reflection; continue to weigh the sensor limits.',
      };
      if (evidence.some(item => item.summary.includes('supports coordination'))) return {
        contactId: track.id, label: 'Possible coordinated activity', confidence: 'moderate',
        basis: 'Multiple contacts share route timing; this supports coordination but does not establish intent.',
      };
      if (hasEO) return {
        contactId: track.id, label: 'Possible UAV', confidence: 'moderate',
        basis: 'EO acquired an unclassified visual contact; affiliation and intent remain unconfirmed.',
      };
      return {
        contactId: track.id, label: 'Unidentified aerial contact', confidence: 'low',
        basis: 'Radar evidence is available; object type and affiliation are not established.',
      };
    });
  }

  private finish(): void {
    if (this.currentStatus === 'completed') return;
    this.currentStatus = 'completed';
    this.recordEvent('exercise-finished', undefined, 'The exercise was completed.');
    this.review = this.scoreReview();
  }

  private scoreReview(): ExerciseReview {
    const contacts = [...this.publicTracks.values()];
    const detectionScores = contacts.map(track => {
      const acknowledgedAt = this.acknowledgementTimes.get(track.id);
      if (acknowledgedAt === undefined) return 0;
      const latency = Math.max(0, acknowledgedAt - track.firstEvidenceTime);
      if (latency <= 5) return 100;
      if (latency >= 60) return 0;
      return 100 * (60 - latency) / 55;
    });
    const detection = detectionScores.length
      ? roundScore(detectionScores.reduce((sum, score) => sum + score, 0) / detectionScores.length) : 0;
    const escapedNote = this.escapedContacts.size
      ? ` ${this.escapedContacts.size} contact(s) left the operation area without a trainee report and scored zero.` : '';
    const coordinatedLead = this.coordinatedLead();
    const classification = contacts.length
      ? this.fixture === 'coordinated'
        ? roundScore(coordinatedLead ? this.scoreClassification(coordinatedLead) : 0)
        : roundScore(contacts.reduce((sum, track) => sum + this.scoreClassification(track), 0) / contacts.length) : 0;
    const threatAssessment = contacts.length
      ? this.fixture === 'coordinated'
        ? roundScore(coordinatedLead ? this.scoreThreat(coordinatedLead) : 0)
        : roundScore(contacts.reduce((sum, track) => sum + this.scoreThreat(track), 0) / contacts.length) : 0;
    const decisionQuality = this.scoreDecisionQuality();
    const overall = roundScore(detection * 0.25 + classification * 0.3 + threatAssessment * 0.2 + decisionQuality * 0.25);
    const first = contacts[0];
    const firstAck = first ? this.acknowledgementTimes.get(first.id) : undefined;
    const latency = first && firstAck !== undefined ? roundScore(Math.max(0, firstAck - first.firstEvidenceTime)) : undefined;
    const leadTruth = first ? this.internalByContactId.get(first.id)?.truth ?? truthFor(this.fixture) : truthFor(this.fixture);
    return {
      scores: { detection, classification, threatAssessment, decisionQuality }, overall,
      detectionLatencySeconds: latency, criticalDecisionError: this.criticalDecisionError,
      reasons: {
        detection: detection === 100
          ? 'Acknowledged within five simulation seconds of first delivered evidence.'
          : `Latency is measured from first delivered evidence until acknowledgement.${escapedNote}`,
        classification: this.fixture === 'coordinated'
          ? 'The first acknowledged contact is the group lead; its evidence-based assessment applies to the coordinated group, which is reported once.'
          : 'Object type, coordination and affiliation are scored separately; unconfirmed status is accepted when decisive evidence is unavailable.',
        threatAssessment: 'Threat assessment is scored independently from object type and affiliation.',
        decisionQuality: this.criticalDecisionError
          ? 'A response was attempted without command authorization or an alert was raised for the friendly fixture; decision quality is zero.'
          : this.fixture === 'coordinated'
            ? 'One verified, proportionate group report on the first acknowledged lead contact completes the group response objective.'
          : 'Verification, proportionate action and follow-through contribute 30, 40 and 30 points.',
      },
      chronology: this.events.map(event => ({ ...event })),
      summary: 'Review the evidence timeline, acknowledge contacts promptly, separate classification from threat, and choose a proportionate high-level action.',
      groundTruth: {
        ...leadTruth,
        contacts: contacts.map(track => ({ contactId: track.id, escaped: this.escapedContacts.has(track.id), ...(this.internalByContactId.get(track.id)?.truth ?? truthFor(this.fixture)) })),
      },
    };
  }

  private scoreClassification(track: ExerciseTrack): number {
    const assessment = this.assessments.get(track.id) ?? {};
    const evidence = this.evidenceByContact.get(track.id) ?? [];
    const truth = this.internalByContactId.get(track.id)?.truth ?? truthFor(this.fixture);
    const hasDecisiveEO = evidence.some(item => item.source === 'eo' && (item.quality ?? 0) >= 0.6);
    const objectScore = assessment.objectType === truth.objectType ? 100
      : assessment.objectType === 'unknown' && (truth.objectType === 'non-uav' || !hasDecisiveEO) ? 100 : 0;
    const hasCoordinationClue = evidence.some(item => item.source === 'history' && item.summary.includes('supports coordination'));
    const coordinationScore = assessment.coordination === truth.coordination && (truth.coordination !== 'coordinated' || hasCoordinationClue)
      ? 100 : assessment.coordination === 'unknown' && (truth.coordination !== 'coordinated' || !hasCoordinationClue) ? 100 : 0;
    const hasAffiliationEvidence = evidence.some(item => item.source === 'roster' && (item.quality ?? 0) >= 0.8);
    const affiliationScore = assessment.affiliation === truth.affiliation
      ? 100 : assessment.affiliation === 'unconfirmed' && !hasAffiliationEvidence ? 100 : 0;
    return objectScore * 0.5 + coordinationScore * 0.3 + affiliationScore * 0.2;
  }

  private scoreThreat(track: ExerciseTrack): number {
    const threat = this.assessments.get(track.id)?.threat;
    const expected = (this.internalByContactId.get(track.id)?.truth ?? truthFor(this.fixture)).threat;
    if (threat === expected) return 100;
    const order: ExerciseThreat[] = ['low', 'medium', 'high', 'critical'];
    if (threat && Math.abs(order.indexOf(threat) - order.indexOf(expected)) === 1) return 50;
    return 0;
  }

  private coordinatedLead(): ExerciseTrack | undefined {
    const first = [...this.acknowledgementTimes.entries()]
      .sort(([leftId,leftTime],[rightId,rightTime]) => leftTime-rightTime || Number(leftId.slice(2))-Number(rightId.slice(2)))[0];
    return first ? this.publicTracks.get(first[0]) : undefined;
  }

  private scoreDecisionQuality(): number {
    if (this.criticalDecisionError) return 0;
    const leadId = this.fixture === 'coordinated' ? this.coordinatedLead()?.id : undefined;
    const objectiveActions = leadId ? this.actions.filter(action => action.contactId === leadId) : this.actions;
    const types = new Set(objectiveActions.map(action => action.type));
    const verification = leadId
      ? this.verificationContacts.has(leadId) || objectiveActions.some(action => isRequest(action.type))
      : this.verificationContacts.size > 0 || [...types].some(isRequest);
    const proportionate = this.fixture === 'friendly'
      ? types.has('monitor') ? 40 : types.has('report') ? 20 : 0
      : types.has('report') ? 40
        : types.has('alert') && [...this.assessments.values()].some(value => value.threat === 'high' || value.threat === 'critical') ? 40 : 0;
    const followThrough = types.has('report') || types.has('monitor') ? 30 : 0;
    return (verification ? 30 : 0) + proportionate + followThrough;
  }
}
