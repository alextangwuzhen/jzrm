import { createContext, useContext } from 'react';
import type { AppState, Entity, EntityKind, NewEntity } from './store';

export interface AppContextValue {
  state: AppState;
  route: string;
  workId?: string;
  navigate(path: string): void;
  add(kind: EntityKind, title: string, content?: string, extra?: Partial<NewEntity>): Entity;
  update(id: string, patch: Partial<Pick<Entity, 'title' | 'content' | 'category' | 'meta' | 'parentId'>>): void;
  trash(id: string): void;
  restore(id: string): void;
  purge(id: string): void;
  replaceState(next: AppState): void;
  notify(message: string): void;
  openAi(prompt?: string): void;
  ask(question: string, defaultValue?: string): Promise<string | null>;
  confirm(question: string): Promise<boolean>;
}

export const AppContext = createContext<AppContextValue | null>(null);
export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppContext missing');
  return value;
}
