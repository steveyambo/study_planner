type OriginRequest = { url: string; headers: Headers };

// A reverse proxy may give Next.js an internal HTTP URL. Only a server-configured
// public origin can replace it; client-supplied forwarding headers are ignored.
export function requestOrigin(request: OriginRequest) {
  const configured = process.env.APP_PUBLIC_ORIGIN;
  if (!configured) return new URL(request.url).origin;
  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error("APP_PUBLIC_ORIGIN doit contenir uniquement une origine HTTP ou HTTPS.");
  }
  return url.origin;
}

export function hasSameOrigin(request: OriginRequest) {
  return request.headers.get("origin") === requestOrigin(request);
}
