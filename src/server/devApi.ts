import { createMemoryUserStateStore, resetMemoryUserStateStore } from './stateStore';
import { handleBootstrapRequest, handleSaveStateRequest } from './api';

const DEV_SESSION = { id: 'local-dev-user', email: 'local-dev@example.com' };

interface IncomingMessageLike {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  on(event: 'data', listener: (chunk: unknown) => void): void;
  on(event: 'end', listener: () => void): void;
  on(event: 'error', listener: (error: unknown) => void): void;
}

interface ServerResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: Uint8Array | string): void;
}

function toAbsoluteUrl(request: IncomingMessageLike): string {
  return `http://127.0.0.1${request.url ?? '/'}`;
}

function concatenateChunks(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return merged;
}

async function toWebRequest(request: IncomingMessageLike): Promise<Request> {
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await new Promise<Uint8Array>((resolve, reject) => {
          const chunks: Uint8Array[] = [];
          request.on('data', (chunk) => {
            if (chunk instanceof Uint8Array) {
              chunks.push(chunk);
              return;
            }

            if (typeof chunk === 'string') {
              chunks.push(new TextEncoder().encode(chunk));
              return;
            }

            reject(new Error('Unexpected request body chunk type'));
          });
          request.on('end', () => resolve(concatenateChunks(chunks)));
          request.on('error', reject);
        });

  const headers = Object.entries(request.headers)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value ?? ''] as [string, string]);
  const requestBody = body ? new TextDecoder().decode(body) : undefined;

  return new Request(toAbsoluteUrl(request), {
    method: request.method,
    headers,
    body: requestBody,
  });
}

async function sendWebResponse(response: Response, nodeResponse: ServerResponseLike): Promise<void> {
  nodeResponse.statusCode = response.status;
  response.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });
  nodeResponse.end(new Uint8Array(await response.arrayBuffer()));
}

export async function handleDevApi(request: IncomingMessageLike, response: ServerResponseLike): Promise<boolean> {
  if (!request.url?.startsWith('/api/')) {
    return false;
  }

  const webRequest = await toWebRequest(request);
  const store = createMemoryUserStateStore();

  if (request.method === 'GET' && request.url.startsWith('/api/bootstrap')) {
    await sendWebResponse(await handleBootstrapRequest(store, DEV_SESSION), response);
    return true;
  }

  if (request.method === 'PUT' && request.url.startsWith('/api/state')) {
    await sendWebResponse(await handleSaveStateRequest(webRequest, store, DEV_SESSION), response);
    return true;
  }

  if (request.method === 'POST' && request.url.startsWith('/api/dev/reset')) {
    resetMemoryUserStateStore();
    await sendWebResponse(await handleBootstrapRequest(store, DEV_SESSION), response);
    return true;
  }

  response.statusCode = 404;
  response.end('Not Found');
  return true;
}
