import type { AppState } from '../types/app';
import type { BootstrapResponse, SaveStateResponse } from '../server/types';

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const fallback = `${response.status} ${response.statusText}`;
    try {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? fallback);
    } catch {
      throw new Error(fallback);
    }
  }

  return (await response.json()) as T;
}

export async function fetchBootstrap(): Promise<BootstrapResponse> {
  const response = await fetch('/api/bootstrap', {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
  });
  return parseJsonResponse<BootstrapResponse>(response);
}

export async function pushState(state: AppState): Promise<SaveStateResponse> {
  const response = await fetch('/api/state', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ state }),
  });
  return parseJsonResponse<SaveStateResponse>(response);
}
