import type { AppState, SessionUser } from '../types/app';

export interface BootstrapResponse {
  session: SessionUser;
  state: AppState;
}

export interface SaveStateRequest {
  state: AppState;
}

export interface SaveStateResponse {
  session: SessionUser;
  state: AppState;
  applied: 'saved' | 'ignored';
}
