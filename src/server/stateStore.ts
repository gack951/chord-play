import { createInitialState, normalizeAppState } from '../state/song';
import type { AppState, SessionUser } from '../types/app';

const D1_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS user_states (
  user_key TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

interface D1PreparedStatementLike {
  bind(...values: unknown[]): {
    first<T>(): Promise<T | null>;
    run(): Promise<unknown>;
  };
}

interface D1DatabaseLike {
  exec(query: string): Promise<unknown>;
  prepare(query: string): D1PreparedStatementLike;
}

interface StoredRow {
  user_key: string;
  email: string;
  state_json: string;
  updated_at: string;
  created_at: string;
}

export interface UserStateStore {
  load(session: SessionUser): Promise<AppState>;
  save(session: SessionUser, incomingState: AppState): Promise<{ state: AppState; applied: 'saved' | 'ignored' }>;
}

function cloneState(state: AppState): AppState {
  return structuredClone(state);
}

function normalizeUpdatedAt(state: AppState, fallback = new Date().toISOString()): AppState {
  return {
    ...state,
    updatedAt: state.updatedAt || fallback,
  };
}

export function normalizeUserId(id: string): string {
  return id.trim();
}

function normalizeStoredEmail(email: string | null): string {
  return email?.trim().toLowerCase() ?? '';
}

function chooseLatestState(currentState: AppState, incomingState: AppState): { state: AppState; applied: 'saved' | 'ignored' } {
  return incomingState.updatedAt >= currentState.updatedAt
    ? { state: cloneState(incomingState), applied: 'saved' }
    : { state: cloneState(currentState), applied: 'ignored' };
}

class MemoryUserStateStore implements UserStateStore {
  private readonly rows = new Map<string, AppState>();

  reset(): void {
    this.rows.clear();
  }

  async load(session: SessionUser): Promise<AppState> {
    const key = normalizeUserId(session.id);
    const state = this.rows.get(key);
    if (!state) {
      const initial = createInitialState();
      this.rows.set(key, cloneState(initial));
      return initial;
    }

    return cloneState(state);
  }

  async save(session: SessionUser, incomingState: AppState): Promise<{ state: AppState; applied: 'saved' | 'ignored' }> {
    const key = normalizeUserId(session.id);
    const normalizedIncoming = normalizeUpdatedAt(normalizeAppState(incomingState));
    const current = this.rows.get(key) ?? createInitialState();
    const resolved = chooseLatestState(current, normalizedIncoming);
    this.rows.set(key, cloneState(resolved.state));
    return resolved;
  }
}

class D1UserStateStore implements UserStateStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async load(session: SessionUser): Promise<AppState> {
    await this.db.exec(D1_SCHEMA_SQL);
    const key = normalizeUserId(session.id);
    const row = await this.db
      .prepare('SELECT user_key, email, state_json, updated_at, created_at FROM user_states WHERE user_key = ?')
      .bind(key)
      .first<StoredRow>();

    if (!row) {
      const initial = createInitialState();
      await this.persistRow(key, session.email, initial, initial.updatedAt, initial.updatedAt);
      return initial;
    }

    return normalizeAppState(JSON.parse(row.state_json));
  }

  async save(session: SessionUser, incomingState: AppState): Promise<{ state: AppState; applied: 'saved' | 'ignored' }> {
    await this.db.exec(D1_SCHEMA_SQL);
    const key = normalizeUserId(session.id);
    const normalizedIncoming = normalizeUpdatedAt(normalizeAppState(incomingState));
    const row = await this.db
      .prepare('SELECT user_key, email, state_json, updated_at, created_at FROM user_states WHERE user_key = ?')
      .bind(key)
      .first<StoredRow>();

    const current = row ? normalizeAppState(JSON.parse(row.state_json)) : createInitialState();
    const resolved = chooseLatestState(current, normalizedIncoming);
    const createdAt = row?.created_at ?? resolved.state.updatedAt;
    await this.persistRow(key, session.email, resolved.state, resolved.state.updatedAt, createdAt);
    return resolved;
  }

  private async persistRow(
    key: string,
    email: string | null,
    state: AppState,
    updatedAt: string,
    createdAt: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO user_states (user_key, email, state_json, updated_at, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_key) DO UPDATE SET
           email = excluded.email,
           state_json = excluded.state_json,
           updated_at = excluded.updated_at`,
      )
      .bind(key, normalizeStoredEmail(email), JSON.stringify(state), updatedAt, createdAt)
      .run();
  }
}

const memoryStore = new MemoryUserStateStore();

export function createMemoryUserStateStore(): UserStateStore {
  return memoryStore;
}

export function resetMemoryUserStateStore(): void {
  memoryStore.reset();
}

export function createD1UserStateStore(db: D1DatabaseLike): UserStateStore {
  return new D1UserStateStore(db);
}
