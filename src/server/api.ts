import type { SessionUser } from '../types/app';
import type { BootstrapResponse, SaveStateRequest, SaveStateResponse } from './types';
import type { UserStateStore } from './stateStore';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function handleBootstrapRequest(store: UserStateStore, session: SessionUser): Promise<Response> {
  const state = await store.load(session);
  const payload: BootstrapResponse = {
    session,
    state,
  };
  return jsonResponse(payload);
}

export async function handleSaveStateRequest(request: Request, store: UserStateStore, session: SessionUser): Promise<Response> {
  let payload: SaveStateRequest;

  try {
    payload = (await request.json()) as SaveStateRequest;
  } catch {
    return jsonResponse({ error: 'JSON の構文が不正です' }, 400);
  }

  if (!payload || typeof payload !== 'object' || !payload.state) {
    return jsonResponse({ error: 'state が必要です' }, 400);
  }

  const result = await store.save(session, payload.state);
  const response: SaveStateResponse = {
    session,
    state: result.state,
    applied: result.applied,
  };
  return jsonResponse(response);
}
