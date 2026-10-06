import type { ScenarioConfig } from '../simulation/types';
import type { SensorHealthSummary } from '../simulation/SensorEngine';

/** Private resolved configuration, disclosed only after completion. */
export interface ResolvedExerciseRecipe {
  version: 1;
  generation: { version: string; requestedSeed: number; resolvedSeed: number; retries: number; fallbackUsed: boolean };
  setting: 'rural' | 'semi-urban';
  sensorHealth: SensorHealthSummary;
  scenario: ScenarioConfig;
}
