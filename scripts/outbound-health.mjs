const urls = (process.env.OUTBOUND_HEALTHCHECK_URLS ?? "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

if (urls.length === 0) {
  // eslint-disable-next-line no-console
  console.warn("OUTBOUND_HEALTHCHECK_URLS is not configured. Skipping outbound check.");
  process.exit(0);
}

const timeoutMs = Number(process.env.OUTBOUND_HEALTHCHECK_TIMEOUT_MS ?? 5000);

const checkUrl = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(url, { method: "HEAD", signal: controller.signal });
    if (res.status === 405) {
      res = await fetch(url, { method: "GET", signal: controller.signal });
    }
    if (!res.ok) {
      return { url, ok: false, status: res.status };
    }
    return { url, ok: true, status: res.status };
  } catch (err) {
    return { url, ok: false, status: "error", error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
};

const results = await Promise.all(urls.map(checkUrl));
const failures = results.filter((r) => !r.ok);

if (failures.length > 0) {
  // eslint-disable-next-line no-console
  console.error("Outbound health check failed:", failures);
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log("Outbound health check passed:", results);
