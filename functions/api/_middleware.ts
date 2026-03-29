import cloudflareAccessPlugin from '@cloudflare/pages-plugin-cloudflare-access';

interface Env {
  CLOUDFLARE_ACCESS_DOMAIN: string;
  CLOUDFLARE_ACCESS_AUD: string;
}

interface Context {
  env: Env;
  data: Record<string, unknown>;
  request: Request;
  next: () => Promise<Response>;
}

export const onRequest = async (context: Context): Promise<Response> => {
  if (!context.env.CLOUDFLARE_ACCESS_DOMAIN || !context.env.CLOUDFLARE_ACCESS_AUD) {
    return new Response('Cloudflare Access environment variables are missing.', { status: 500 });
  }

  const middleware = cloudflareAccessPlugin({
    domain: context.env.CLOUDFLARE_ACCESS_DOMAIN as `https://${string}.cloudflareaccess.com`,
    aud: context.env.CLOUDFLARE_ACCESS_AUD,
  }) as (input: Context) => Promise<Response>;

  return middleware(context);
};
