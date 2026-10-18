import { describe, it, expect } from 'vitest';
import { ExerciseEngine } from './Exercise';
import type { SensorTrack } from '../simulation/SensorEngine';

const plot = (state: SensorTrack['state'], age: number, time: number, options: { entityId?: string; key?: string } = {}): SensorTrack =>
  ({ id: options.key ?? 'radar-aerial-01', sensorId: 'radar', entityId: options.entityId ?? 'aerial-01', label: 'Track 01',
    position: { x: 120, y: 40, z: 140 }, time, bearing: 40, elevation: 3, state, quality: .6, age, detections: 4, missed: state === 'coasting' || state === 'lost' ? 4 : 0 });

describe('transit reporting window', () => {
  it('scores a contact whose entity left the operation area without a trainee report', () => {
    const engine = new ExerciseEngine({ seed: 42, quietPeriod: 0, fixture: 'basic' });
    engine.tick(1, [plot('acquiring', 0, 1)], []);
    engine.tick(10, [plot('firm', 0, 10)], []);
    // The transit entity reaches its route end and stops being reported.
    engine.tick(24, [plot('coasting', 3, 21)], []);
    engine.tick(25, [plot('coasting', 4, 21)], [], new Set(['aerial-01']));
    const state = engine.state();
    const escaped = state.chronology.filter(event => event.type === 'contact-escaped');
    expect(escaped).toHaveLength(1);
    expect(escaped[0].contactId).toBe(state.tracks[0]?.id);
    // A later lateness never repairs the escape; repeated ticks stay terminal.
    engine.tick(26, [plot('lost', 5, 21)], [], new Set(['aerial-01']));
    expect(engine.state().chronology.filter(event => event.type === 'contact-escaped')).toHaveLength(1);
    engine.act({ type: 'finish' });
    const review = engine.state().review!;
    expect(review.scores.detection).toBe(0);
    expect(review.reasons.detection).toContain('left the operation area without a trainee report');
    expect(review.groundTruth.contacts[0]?.escaped).toBe(true);
  });

  it('does not escape a reported contact that goes stale, nor a live masked contact', () => {
    const engine = new ExerciseEngine({ seed: 42, quietPeriod: 0, fixture: 'basic' });
    engine.tick(1, [plot('acquiring', 0, 1)], []);
    engine.tick(6, [plot('firm', 0, 6)], []);
    const contactId = engine.state().tracks[0]?.id!;
    expect(engine.act({ type: 'acknowledge-track', contactId })).toBe(true);
    // Entity leaves the ring: acknowledged contacts are already reported and stay reported.
    engine.tick(30, [plot('coasting', 4, 26)], [], new Set(['aerial-01']));
    expect(engine.state().chronology.some(event => event.type === 'contact-escaped')).toBe(false);
    // An unacknowledged contact that is merely LOS-masked and still alive never escapes.
    const masked = new ExerciseEngine({ seed: 43, quietPeriod: 0, fixture: 'basic' });
    masked.tick(1, [plot('acquiring', 0, 1)], []);
    masked.tick(6, [plot('firm', 0, 6)], []);
    const maskedId = masked.state().tracks[0]?.id!;
    for (let second = 7; second <= 30; second++) masked.tick(second, [plot('coasting', second - 21, 21)], []);
    expect(masked.state().chronology.some(event => event.type === 'contact-escaped' && event.contactId === maskedId)).toBe(false);
    expect(engine.state().tracks.find(item => item.id === contactId)?.acknowledged).toBe(true);
  });
});
