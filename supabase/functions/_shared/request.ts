export function createRequestId(req: Request) {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function getClientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}
