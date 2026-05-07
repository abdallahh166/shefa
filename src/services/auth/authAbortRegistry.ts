const controllers = new Map<string, AbortController>();

export function createAbortScope(scopeId: string): AbortSignal {
  const existing = controllers.get(scopeId);
  existing?.abort();
  const next = new AbortController();
  controllers.set(scopeId, next);
  return next.signal;
}

export function abortScope(scopeId: string, reason?: string) {
  const c = controllers.get(scopeId);
  if (c) {
    try {
      c.abort(reason ?? scopeId);
    } catch {
      /* ignore */
    }
    controllers.delete(scopeId);
  }
}

export function abortAllAuthBoundary(reason = "auth_boundary") {
  for (const [id, c] of controllers) {
    try {
      c.abort(reason);
    } catch {
      /* ignore */
    }
    controllers.delete(id);
  }
}
