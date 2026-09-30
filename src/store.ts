export type EntityKind = 'work' | 'volume' | 'chapter' | 'outline' | 'fineOutline' | 'setting' | 'memory' | 'inspiration' | 'split' | 'style' | 'agent' | 'skill' | 'prompt' | 'provider' | 'workflow' | 'adaptation' | 'roleBook' | 'clue' | 'manual' | 'review' | 'snapshot' | 'chat' | 'attachment';

export interface Entity {
  id: string;
  kind: EntityKind;
  title: string;
  content: string;
  workId?: string;
  parentId?: string;
  category?: string;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deleteBatchId?: string;
}

export interface AppState {
  version: 1;
  entities: Entity[];
  preferences: { activeWorkId?: string; theme: 'light' | 'dark'; currentWorkflowId?: string; contextLimit?: number; memoryLearning?: boolean };
}

export type NewEntity = Pick<Entity, 'id' | 'kind' | 'title'> & Partial<Pick<Entity, 'content' | 'workId' | 'parentId' | 'category' | 'meta'>>;

export function createInitialState(): AppState {
  return { version: 1, entities: [], preferences: { theme: 'light', contextLimit: 30000, memoryLearning: true } };
}

export function createEntity(state: AppState, input: NewEntity): AppState {
  if (state.entities.some(e => e.id === input.id)) throw new Error('DUPLICATE_ID');
  const now = new Date().toISOString();
  const entity: Entity = { ...input, content: input.content ?? '', meta: input.meta ?? {}, createdAt: now, updatedAt: now };
  return { ...state, entities: [...state.entities, entity] };
}

export function updateEntity(state: AppState, id: string, patch: Partial<Pick<Entity, 'title' | 'content' | 'category' | 'meta' | 'parentId'>>): AppState {
  if (!state.entities.some(e => e.id === id)) throw new Error('NOT_FOUND');
  return { ...state, entities: state.entities.map(e => e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e) };
}

function familyIds(state: AppState, rootId: string): Set<string> {
  const root = state.entities.find(e => e.id === rootId);
  if (!root) throw new Error('NOT_FOUND');
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const entity of state.entities) {
      if (!ids.has(entity.id) && ((entity.parentId && ids.has(entity.parentId)) || (root.kind === 'work' && entity.workId === rootId))) {
        ids.add(entity.id);
        changed = true;
      }
    }
  }
  return ids;
}

export function moveToTrash(state: AppState, id: string): AppState {
  const ids = familyIds(state, id);
  const now = new Date().toISOString();
  const batch = crypto.randomUUID();
  return { ...state, entities: state.entities.map(e => ids.has(e.id) && !e.deletedAt ? { ...e, deletedAt: now, deleteBatchId: batch } : e) };
}

export function restoreEntity(state: AppState, id: string): AppState {
  const root = state.entities.find(e => e.id === id);
  if (!root?.deletedAt) throw new Error('NOT_IN_TRASH');
  const ids = new Set(state.entities.filter(e => e.deleteBatchId === root.deleteBatchId).map(e => e.id));
  if (!ids.has(id)) ids.add(id);
  for (const entity of state.entities.filter(e => ids.has(e.id))) {
    const parent = entity.parentId ? state.entities.find(e => e.id === entity.parentId) : undefined;
    const work = entity.workId ? state.entities.find(e => e.id === entity.workId) : undefined;
    if ((parent?.deletedAt && !ids.has(parent.id)) || (work?.deletedAt && !ids.has(work.id))) throw new Error('PARENT_IN_TRASH');
    if (state.entities.some(other => !ids.has(other.id) && !other.deletedAt && other.kind === entity.kind && other.workId === entity.workId && other.parentId === entity.parentId && other.title === entity.title)) throw new Error('RESTORE_CONFLICT');
  }
  return { ...state, entities: state.entities.map(e => ids.has(e.id) ? { ...e, deletedAt: undefined, deleteBatchId: undefined, updatedAt: new Date().toISOString() } : e) };
}

export function purgeEntity(state: AppState, id: string): AppState {
  const root = state.entities.find(e => e.id === id);
  if (!root?.deletedAt) throw new Error('NOT_IN_TRASH');
  const ids = familyIds(state, id);
  return { ...state, entities: state.entities.filter(e => !ids.has(e.id)) };
}

export function listEntities(state: AppState, query: { kind?: EntityKind; workId?: string; trash?: boolean; category?: string } = {}): Entity[] {
  return state.entities.filter(e => Boolean(e.deletedAt) === Boolean(query.trash) && (!query.kind || e.kind === query.kind) && (!query.workId || e.workId === query.workId) && (!query.category || e.category === query.category));
}
