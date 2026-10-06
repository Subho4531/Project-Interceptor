import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { SessionController } from './SessionController';

const Context = createContext<SessionController | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => new SessionController());
  useEffect(() => {
    controller.startScheduler();
    void controller.loadAssets();
    if (new URLSearchParams(location.search).has('qa')) Object.assign(window, { __sessionQA: {
      snapshot: controller.getSnapshot,
      command: controller.command,
      export: () => controller.exportSession(),
      exercise: () => controller.getExerciseState(),
      exerciseAction: controller.exerciseAction.bind(controller),
    }});
    return () => {
      controller.stopScheduler();
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
