import { describe, expect, it } from 'vitest';
import { environment } from './config';
import { applyEnvironmentSetting } from './EnvironmentVariants';

describe('environment settings', () => {
  it('adds an authored semi-urban cluster without changing terrain, bounds, or the protected perimeter', () => {
    const original = structuredClone(environment);
    const variant = applyEnvironmentSetting(environment, 'semi-urban');
    const added = variant.placements.filter(p => p.id.startsWith('semi-urban-'));

    expect(added.map(p => p.module)).toEqual(['facility', 'facility', 'shelter', 'barrier', 'barrier']);
    expect(variant.setting).toBe('semi-urban');
    expect(variant.terrain).toEqual(environment.terrain);
    expect(variant.bounds).toEqual(environment.bounds);
    expect(variant.protectedZones).toEqual(environment.protectedZones);
    expect(environment).toEqual(original);

    for (const placement of added) {
      expect(placement.position.x - placement.size.x / 2).toBeGreaterThanOrEqual(variant.bounds.minX);
      expect(placement.position.x + placement.size.x / 2).toBeLessThanOrEqual(variant.bounds.maxX);
      expect(placement.position.z - placement.size.z / 2).toBeGreaterThan(variant.protectedZones[0].maxZ);
      expect(placement.position.z + placement.size.z / 2).toBeLessThanOrEqual(variant.bounds.maxZ);
    }
  });

  it('is deterministic and idempotent, and rural selection removes only generated additions', () => {
    const first = applyEnvironmentSetting(environment, 'semi-urban');
    const repeated = applyEnvironmentSetting(first, 'semi-urban');
    expect(repeated.placements).toEqual(first.placements);

    const rural = applyEnvironmentSetting(first, 'rural');
    expect(rural.setting).toBe('rural');
    expect(rural.placements).toEqual(environment.placements);
    expect(rural.bounds).toEqual(environment.bounds);
    expect(rural.protectedZones).toEqual(environment.protectedZones);
  });
});
