import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { environments } from './config';
import { posts } from '../dashboard/posts';
import { GridTerrainSurface,setTerrainSurface } from './TerrainSurface';
import { resolveValidatedScenario,validateResolvedScenario } from './ScenarioValidation';

describe('constrained regional scenarios',()=>{
  it.each(posts)('resolves sensor-led cases on imported $name terrain reproducibly',post=>{
    const environment=structuredClone(environments.find(item=>item.id===post.environmentId)!);
    setTerrainSurface(environment.terrain,new GridTerrainSurface(JSON.parse(readFileSync(`public/assets/regions/${post.id}/heightfield.json`,'utf8'))));
    for(const scenarioId of ['low-ingress','ambiguous','friendly','mixed','coordinated'] as const)for(const seed of [42,26052]){
      const result=resolveValidatedScenario(environment,scenarioId,{seed});
      expect(validateResolvedScenario(result.config,environment)).toEqual([]);
      expect(resolveValidatedScenario(environment,scenarioId,{seed})).toEqual(result);
    }
  });
});
