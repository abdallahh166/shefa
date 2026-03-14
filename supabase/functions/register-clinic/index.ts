import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceCors, getAllowedOriginsFromEnv, buildRedirectUrl } from "../_shared/cors.ts";
import { verifyCaptcha } from "../_shared/captcha.ts";
import { initSentry } from "../_shared/sentry.ts";
import { logError, logInfo } from "../_shared/logger.ts";
import { createRequestId, getClientIp } from "../_shared/request.ts";

const allowedOrigins = getAllowedOriginsFromEnv();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isValidSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

async function sendVerificationEmail(
  apiKey: string,
  to: string,
  actionLink: string,
  clinicName: string,
  fullName: string,
) {
  const subject = "Confirm your clinic account";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Welcome to ${clinicName}</h2>
      <p>Hi ${fullName},</p>
      <p>Please confirm your email address to activate your clinic account.</p>
      <p><a href="${actionLink}" target="_blank" rel="noreferrer">Verify your email</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Clinic Onboarding <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  return res.ok;
}

// --- Durable rate limiter (DB-backed) ---
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 3; // stricter for signup
const EMAIL_RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 hour
const EMAIL_RATE_LIMIT_MAX = 2;

Deno.serve(async (req) => {
  initSentry();
  const { corsHeaders, errorResponse } = enforceCors(req, {
    allowedOrigins,
  });
  const requestId = createRequestId(req);
  const baseHeaders = { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId };

  if (errorResponse) {
    return errorResponse;
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: baseHeaders,
    });
  }

  const clientIp = getClientIp(req);
  logInfo("register_clinic_request", {
    request_id: requestId,
    action_type: "register_clinic",
    resource_type: "tenant",
    metadata: { client_ip: clientIp },
  });

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: allowed, error: rateError } = await adminClient.rpc(
      "check_rate_limit",
      {
        _key: `register-clinic:${clientIp}`,
        _max_hits: RATE_LIMIT_MAX,
        _window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      },
    );

    if (rateError) {
      logError("register_clinic_rate_limit_error", {
        request_id: requestId,
        action_type: "register_clinic",
        resource_type: "tenant",
        metadata: { error: rateError.message },
      });
      return new Response(JSON.stringify({ error: "Rate limiter unavailable" }), {
        status: 503,
        headers: baseHeaders,
      });
    }

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: {
            ...baseHeaders,
            "Retry-After": "30",
          },
        },
      );
    }

    const {
      clinicName,
      fullName,
      email,
      password,
      slug: requestedSlug,
      captchaToken,
    } = await req.json();
    if (!clinicName || !fullName || !email || !password) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: baseHeaders,
      });
    }

    const captchaResult = await verifyCaptcha(captchaToken, clientIp);
    if (!captchaResult.ok) {
      return new Response(JSON.stringify({ error: captchaResult.error ?? "Captcha verification failed" }), {
        status: 400,
        headers: baseHeaders,
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: baseHeaders,
      });
    }

    const { data: emailAllowed, error: emailRateError } = await adminClient.rpc(
      "check_rate_limit",
      {
        _key: `register-clinic-email:${normalizedEmail}`,
        _max_hits: EMAIL_RATE_LIMIT_MAX,
        _window_seconds: EMAIL_RATE_LIMIT_WINDOW_SECONDS,
      },
    );

    if (emailRateError) {
      logError("register_clinic_email_rate_limit_error", {
        request_id: requestId,
        action_type: "register_clinic",
        resource_type: "tenant",
        metadata: { error: emailRateError.message },
      });
      return new Response(JSON.stringify({ error: "Rate limiter unavailable" }), {
        status: 503,
        headers: baseHeaders,
      });
    }

    if (!emailAllowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests for this email. Please try again later." }),
        {
          status: 429,
          headers: {
            ...baseHeaders,
            "Retry-After": "3600",
          },
        },
      );
    }

    const normalizedFullName = String(fullName).trim();
    if (normalizedFullName.length < 2 || normalizedFullName.length > 100) {
      return new Response(JSON.stringify({ error: "Invalid full name" }), {
        status: 400,
        headers: baseHeaders,
      });
    }

    const normalizedClinicName = String(clinicName).trim();
    if (normalizedClinicName.length < 2 || normalizedClinicName.length > 120) {
      return new Response(JSON.stringify({ error: "Invalid clinic name" }), {
        status: 400,
        headers: baseHeaders,
      });
    }

    const passwordStr = String(password);
    if (passwordStr.length < 8 || passwordStr.length > 128) {
      return new Response(JSON.stringify({ error: "Invalid password" }), {
        status: 400,
        headers: baseHeaders,
      });
    }

    const slugInput = requestedSlug
      ? String(requestedSlug).trim()
      : normalizedClinicName;
    const slug = slugify(slugInput);
    if (!slug || !isValidSlug(slug) || slug.length < 2 || slug.length > 60) {
      return new Response(JSON.stringify({ error: "Invalid clinic URL slug" }), {
        status: 400,
        headers: baseHeaders,
      });
    }

    const { data: tenant, error: tenantErr } = await adminClient
      .from("tenants")
      .insert({ name: normalizedClinicName, slug, pending_owner_email: normalizedEmail })
      .select("id")
      .single();

    if (tenantErr || !tenant?.id) {
      let errorMessage = "Failed to create clinic";

      // Check for duplicate slug constraint violation
      if (tenantErr?.message?.includes("slug") || tenantErr?.code === "23505") {
        errorMessage =
          "A clinic with this name already exists. Please choose a different name.";
      }

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
        headers: baseHeaders,
      });
    }

    const { error: subErr } = await adminClient.from("subscriptions").upsert(
      {
        tenant_id: tenant.id,
        plan: "free",
        status: "active",
        amount: 0,
        currency: "EGP",
        billing_cycle: "monthly",
      },
      { onConflict: "tenant_id", ignoreDuplicates: true },
    );

    if (subErr) {
      await adminClient.from("tenants").delete().eq("id", tenant.id);
      return new Response(
        JSON.stringify({ error: "Failed to initialize subscription" }),
        {
          status: 400,
          headers: baseHeaders,
        },
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      await adminClient.from("tenants").delete().eq("id", tenant.id);
      return new Response(JSON.stringify({ error: "Email provider not configured" }), {
        status: 500,
        headers: baseHeaders,
      });
    }

    const redirectTo = buildRedirectUrl(req, "/login", allowedOrigins);

    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "signup",
      email: normalizedEmail,
      password: passwordStr,
      options: {
        data: {
          full_name: normalizedFullName,
          tenant_id: tenant.id,
        },
        redirectTo,
      },
    });

    if (linkErr || !linkData?.action_link) {
      await adminClient.from("tenants").delete().eq("id", tenant.id);
      return new Response(JSON.stringify({ error: linkErr?.message ?? "Failed to create user" }), {
        status: 400,
        headers: baseHeaders,
      });
    }

    const emailSent = await sendVerificationEmail(
      resendApiKey,
      normalizedEmail,
      linkData.action_link,
      normalizedClinicName,
      normalizedFullName,
    );

    if (!emailSent) {
      if (linkData?.user?.id) {
        await adminClient.auth.admin.deleteUser(linkData.user.id);
      }
      await adminClient.from("tenants").delete().eq("id", tenant.id);
      return new Response(JSON.stringify({ error: "Failed to send verification email" }), {
        status: 502,
        headers: baseHeaders,
      });
    }

    // Audit log
    await adminClient.rpc("log_audit_event", {
      _tenant_id: tenant.id,
      _user_id: linkData?.user?.id ?? "00000000-0000-0000-0000-000000000000",
      _action: "clinic_created",
      _entity_type: "tenant",
      _entity_id: tenant.id,
      _details: { clinic_name: normalizedClinicName, owner_email: normalizedEmail },
    });

    return new Response(
      JSON.stringify({ success: true, tenant_id: tenant.id, slug }),
      {
        status: 200,
        headers: baseHeaders,
      },
    );
  } catch (err) {
    logError("register_clinic_failed", {
      request_id: requestId,
      action_type: "register_clinic",
      resource_type: "tenant",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal server error",
      }),
      { status: 500, headers: baseHeaders },
    );
  }
});
