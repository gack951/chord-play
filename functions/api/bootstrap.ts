import { handleBootstrapRequest } from '../../src/server/api';
import { createD1UserStateStore } from '../../src/server/stateStore';

interface Env {
  DB: {
    exec(query: string): Promise<unknown>;
    prepare(query: string): {
      bind(...values: unknown[]): {
        first<T>(): Promise<T | null>;
        run(): Promise<unknown>;
      };
    };
  };
}

interface Context {
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

export const onRequestGet = async (context: Context): Promise<Response> => {
  const payload = context.data.cloudflareAccess?.JWT?.payload;
  const id = payload?.sub ?? payload?.email;
  if (!id) {
    return new Response('Authenticated Cloudflare Access identity is missing.', { status: 401 });
  }

  const store = createD1UserStateStore(context.env.DB);
  return handleBootstrapRequest(store, {
    id,
    email: payload?.email ?? null,
  });
};
