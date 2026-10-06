import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { SessionController } from './SessionController';
import { saveAttempt, type ExerciseCheckpoint } from '../training/AttemptStore';
import { archiveAttempt } from '../training/Archive';

const Context = createContext<SessionController | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => new SessionController());
  useEffect(() => {
    controller.startScheduler();
    void controller.loadAssets();
    const checkpoints=new Map<string,ExerciseCheckpoint[]>();
    let lastKey='',queue=Promise.resolve();
    const persist=()=>{
      const session=controller.getSnapshot();
      if(session.status==='ready'||!['low-ingress','ambiguous','friendly','coordinated','mixed'].includes(session.scenarioId))return;
      const key=`${session.sessionId}:${Math.floor(session.time/5)}:${session.status}:${session.eligibilityFlags?.join(',')}`;
      if(key===lastKey)return;lastKey=key;
      const state=controller.getExerciseState(),history=checkpoints.get(session.sessionId)??[];
      if(!history.length||session.time-history[history.length-1].time>=5-1e-6){history.push({time:session.time,state:structuredClone(state)});checkpoints.set(session.sessionId,history);}
      const record=archiveAttempt(session,state,structuredClone(history),controller.getCompletedRecipe());
      queue=queue.then(()=>saveAttempt(record)).then(()=>controller.reportStorageError(undefined)).catch(error=>controller.reportStorageError(`History save failed: ${String(error)}. Export the review before leaving.`));
    };
    const unsubscribe=controller.subscribe(persist);
    if (new URLSearchParams(location.search).has('qa')) Object.assign(window, { __sessionQA: {
      snapshot: controller.getSnapshot,
      command: controller.command,
      export: () => controller.exportSession(),
      exercise: () => controller.getExerciseState(),
      exerciseAction: controller.exerciseAction.bind(controller),
    }});
    return () => {
      controller.stopScheduler();
      unsubscribe();
      Reflect.deleteProperty(window, '__sessionQA');
    };
  }, [controller]);
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function useSession() {
  const controller = useContext(Context);
  if (!controller) throw new Error('SessionProvider is required.');
  return controller;
}
export function useSessionSnapshot() {
  const controller = useSession();
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot);
}
