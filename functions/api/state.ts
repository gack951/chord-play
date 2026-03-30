import { handleSaveStateRequest } from '../../src/server/api';
import { createD1UserStateStore } from '../../src/server/stateStore';

interface Env {
  DB?: {
    prepare(query: string): {
      run(): Promise<unknown>;
      bind(...values: unknown[]): {
        first<T>(): Promise<T | null>;
        run(): Promise<unknown>;
      };
    };
  };
}

interface Context {
  request: Request;
  env: Env;
  data: {
    cloudflareAccess?: {
      JWT?: {
        payload?: {
          sub?: string;
          email?: string;
        };
      };
    };
  };
}

export const onRequestPut = async (context: Context): Promise<Response> => {
  const payload = context.data.cloudflareAccess?.JWT?.payload;
  const id = payload?.sub ?? payload?.email;
  if (!id) {
    return new Response('Authenticated Cloudflare Access identity is missing.', { status: 401 });
  }

  if (!context.env.DB) {
    return new Response('D1 binding "DB" is missing.', { status: 500 });
  }

  try {
    const store = createD1UserStateStore(context.env.DB);
    return await handleSaveStateRequest(context.request, store, {
      id,
      email: payload?.email ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown state save error';
    return new Response(`State save failed: ${message}`, { status: 500 });
  }
};
