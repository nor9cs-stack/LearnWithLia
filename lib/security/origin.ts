import "server-only";

export function assertTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) throw new Error("MISSING_ORIGIN");
  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = process.env.APP_URL ? new URL(process.env.APP_URL).origin : requestOrigin;
  if (origin !== requestOrigin && origin !== configuredOrigin) throw new Error("UNTRUSTED_ORIGIN");
}
