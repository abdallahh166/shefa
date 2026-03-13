const CAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify";

type CaptchaResult = {
  ok: boolean;
  error?: string;
};

function getCaptchaSecret() {
  return Deno.env.get("HCAPTCHA_SECRET") ?? Deno.env.get("CAPTCHA_SECRET") ?? "";
}

export async function verifyCaptcha(
  token: string | null | undefined,
  clientIp?: string,
): Promise<CaptchaResult> {
  const disabled = (Deno.env.get("CAPTCHA_DISABLED") ?? "").toLowerCase() === "true";
  const secret = getCaptchaSecret();

  if (disabled || !secret) {
    return { ok: true };
  }

  if (!token || token.trim().length === 0) {
    return { ok: false, error: "Captcha token missing" };
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (clientIp) {
    form.set("remoteip", clientIp);
  }

  const response = await fetch(CAPTCHA_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!response.ok) {
    return { ok: false, error: "Captcha verification failed" };
  }

  const data = await response.json();
  if (!data?.success) {
    return { ok: false, error: "Captcha verification failed" };
  }

  return { ok: true };
}
