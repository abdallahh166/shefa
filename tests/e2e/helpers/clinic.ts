import { createClient, type Session } from "@supabase/supabase-js";
import { expect, Page } from "@playwright/test";

export type E2EClinicConfig = {
  adminEmail?: string;
  adminPassword?: string;
  clinicSlug?: string;
  clinicName?: string;
  doctorName?: string;
};

function createBrowserlessClinicClient() {
  const supabaseUrl = process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("E2E Supabase credentials are missing");
  }

  return createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function buildSupabaseStorageKey(supabaseUrl: string) {
  const hostname = new URL(supabaseUrl).hostname;
  return `sb-${hostname.split(".")[0]}-auth-token`;
}

export function getClinicConfig(): E2EClinicConfig {
  return {
    adminEmail: process.env.E2E_ADMIN_EMAIL,
    adminPassword: process.env.E2E_ADMIN_PASSWORD,
    clinicSlug: process.env.E2E_CLINIC_SLUG,
    clinicName: process.env.E2E_CLINIC_NAME,
    doctorName: process.env.E2E_DOCTOR_NAME,
  };
}

export function hasClinicConfig(config: E2EClinicConfig): boolean {
  return Boolean(config.adminEmail && config.adminPassword && config.clinicSlug);
}

export function formatDatetimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function prepareEnglishSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "medflow-i18n",
      JSON.stringify({ state: { locale: "en", dir: "ltr", calendarType: "gregorian" }, version: 0 }),
    );
  });
}

export async function loginToClinic(page: Page, config: E2EClinicConfig) {
  if (!config.adminEmail || !config.adminPassword || !config.clinicSlug) {
    throw new Error("E2E clinic credentials are missing");
  }

  await prepareEnglishSession(page);
  await page.goto("/login");
  await page.getByTestId("login-email").fill(config.adminEmail);
  await page.getByTestId("login-password").fill(config.adminPassword);
  await page.getByTestId("login-submit").click();
  await page.waitForLoadState("networkidle");

  try {
    await expect(page).toHaveURL(new RegExp(`/tenant/${config.clinicSlug}/`), { timeout: 10_000 });
  } catch {
    await attachClinicSession(page, config);
    await page.goto(`/tenant/${config.clinicSlug}/dashboard`);
    await expect(page).toHaveURL(new RegExp(`/tenant/${config.clinicSlug}/`), { timeout: 30_000 });
  }
}

export async function submitClinicLogin(page: Page, config: E2EClinicConfig) {
  if (!config.adminEmail || !config.adminPassword) {
    throw new Error("E2E clinic credentials are missing");
  }

  await prepareEnglishSession(page);
  await page.goto("/login");
  await page.getByTestId("login-email").fill(config.adminEmail);
  await page.getByTestId("login-password").fill(config.adminPassword);
  await page.getByTestId("login-submit").click();
  await page.waitForLoadState("networkidle");
}

export async function attachClinicSession(page: Page, config: E2EClinicConfig): Promise<Session> {
  if (!config.adminEmail || !config.adminPassword) {
    throw new Error("E2E clinic credentials are missing");
  }

  const supabaseUrl = process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("E2E Supabase URL is missing");
  }

  const client = createBrowserlessClinicClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: config.adminEmail,
    password: config.adminPassword,
  });

  if (error || !data.session) {
    throw error ?? new Error("Failed to create clinic session");
  }

  await prepareEnglishSession(page);
  await page.goto("/login");
  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    {
      key: buildSupabaseStorageKey(supabaseUrl),
      value: JSON.stringify(data.session),
    },
  );

  return data.session;
}

export async function createPatient(page: Page, clinicSlug: string, patientName: string) {
  await page.goto(`/tenant/${clinicSlug}/patients`);
  await page.getByTestId("patients-add-button").click();
  const dialog = page.getByRole("dialog").last();
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("patient-full-name").fill(patientName);
  await dialog.locator('input[type="date"]').fill("1990-01-01");
  await dialog.locator('input[type="email"]').fill(
    `${patientName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/(^\.|\.$)/g, "")}@mailinator.com`,
  );
  await dialog.locator("form").evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await expect(dialog).not.toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(patientName).first()).toBeVisible({ timeout: 30_000 });
}

async function openSelectAndChoose(page: Page, triggerTestId: string, optionName?: string) {
  await page.getByTestId(triggerTestId).click();

  const options = page.locator('[role="option"]');
  await expect(options.first()).toBeVisible({ timeout: 30_000 });

  if (optionName) {
    const option = page.getByRole("option", { name: optionName }).first();
    await expect(option).toBeVisible({ timeout: 30_000 });
    await option.click();
    return optionName;
  }

  const selectedText = (await options.first().innerText()).trim();
  await options.first().click();
  return selectedText;
}

export async function createAppointment(
  page: Page,
  config: E2EClinicConfig,
  input: {
    patientName: string;
    appointmentDate: Date;
    type?: "checkup" | "follow_up" | "consultation" | "emergency";
    notes?: string;
    doctorName?: string;
    expectDialogClose?: boolean;
  },
) {
  if (!config.clinicSlug) throw new Error("E2E clinic slug is missing");

  await page.goto(`/tenant/${config.clinicSlug}/appointments`);
  await page.getByTestId("appointments-add-button").click();
  const dialog = page.getByRole("dialog").last();
  await expect(dialog).toBeVisible({ timeout: 30_000 });

  await page.getByTestId("appointment-patient-search").fill(input.patientName);
  await page.waitForTimeout(400);
  await openSelectAndChoose(page, "appointment-patient-select", input.patientName);

  if (input.doctorName ?? config.doctorName) {
    await page.getByTestId("appointment-doctor-search").fill(input.doctorName ?? config.doctorName ?? "");
    await page.waitForTimeout(400);
  }
  const selectedDoctorName = await openSelectAndChoose(
    page,
    "appointment-doctor-select",
    input.doctorName ?? config.doctorName,
  );

  await page.getByTestId("appointment-date").fill(formatDatetimeLocal(input.appointmentDate));

  if (input.type && input.type !== "checkup") {
    await page.locator("form").getByRole("button", { name: "Check-up" }).click();
    const typeLabel =
      input.type === "follow_up"
        ? "Follow-up"
        : input.type === "consultation"
          ? "Consultation"
          : "Emergency";
    await page.getByRole("option", { name: typeLabel }).click();
  }

  if (input.notes) {
    await page.locator("form").getByLabel("Notes").fill(input.notes);
  }

  await dialog.locator("form").evaluate((form) => (form as HTMLFormElement).requestSubmit());

  if (input.expectDialogClose ?? true) {
    await expect(dialog).not.toBeVisible({ timeout: 30_000 });
  }

  return {
    doctorName: selectedDoctorName,
    appointmentDate: formatDatetimeLocal(input.appointmentDate),
  };
}

export async function seedAppointment(
  config: E2EClinicConfig,
  input: {
    patientName: string;
    appointmentDate: Date;
    doctorName?: string;
    type?: "checkup" | "follow_up" | "consultation" | "emergency";
  },
) {
  if (!config.adminEmail || !config.adminPassword || !config.clinicSlug) {
    throw new Error("E2E clinic credentials are missing");
  }

  const client = createBrowserlessClinicClient();
  const signIn = await client.auth.signInWithPassword({
    email: config.adminEmail,
    password: config.adminPassword,
  });

  if (signIn.error) {
    throw signIn.error;
  }

  const { data: patient, error: patientError } = await client
    .from("patients")
    .select("id, tenant_id")
    .eq("full_name", input.patientName)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (patientError || !patient?.id || !patient?.tenant_id) {
    throw patientError ?? new Error(`Failed to resolve patient ${input.patientName}`);
  }

  const { data: doctor, error: doctorError } = await client
    .from("doctors")
    .select("id")
    .eq("tenant_id", patient.tenant_id)
    .eq("full_name", input.doctorName ?? config.doctorName ?? "")
    .limit(1)
    .maybeSingle();

  if (doctorError || !doctor?.id) {
    throw doctorError ?? new Error(`Failed to resolve doctor ${input.doctorName ?? config.doctorName ?? ""}`);
  }

  const appointmentDate = new Date(input.appointmentDate);

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const { error: appointmentError } = await client.from("appointments").insert({
      tenant_id: patient.tenant_id,
      patient_id: patient.id,
      doctor_id: doctor.id,
      appointment_date: formatDatetimeLocal(appointmentDate),
      duration_minutes: 30,
      type: input.type ?? "checkup",
      status: "scheduled",
    });

    if (!appointmentError) {
      return { appointmentDate };
    }

    if (appointmentError.code !== "23P01") {
      throw appointmentError;
    }

    appointmentDate.setMinutes(appointmentDate.getMinutes() + 60);
  }

  throw new Error("Failed to seed an appointment without conflicts after multiple attempts");
}

export async function expectAppointmentConflictViaApi(
  config: E2EClinicConfig,
  input: {
    patientName: string;
    appointmentDate: Date;
    doctorName?: string;
    type?: "checkup" | "follow_up" | "consultation" | "emergency";
  },
) {
  if (!config.adminEmail || !config.adminPassword || !config.clinicSlug) {
    throw new Error("E2E clinic credentials are missing");
  }

  const client = createBrowserlessClinicClient();
  const signIn = await client.auth.signInWithPassword({
    email: config.adminEmail,
    password: config.adminPassword,
  });

  if (signIn.error) {
    throw signIn.error;
  }

  const { data: patient, error: patientError } = await client
    .from("patients")
    .select("id, tenant_id")
    .eq("full_name", input.patientName)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (patientError || !patient?.id || !patient?.tenant_id) {
    throw patientError ?? new Error(`Failed to resolve patient ${input.patientName}`);
  }

  const { data: doctor, error: doctorError } = await client
    .from("doctors")
    .select("id")
    .eq("tenant_id", patient.tenant_id)
    .eq("full_name", input.doctorName ?? config.doctorName ?? "")
    .limit(1)
    .maybeSingle();

  if (doctorError || !doctor?.id) {
    throw doctorError ?? new Error(`Failed to resolve doctor ${input.doctorName ?? config.doctorName ?? ""}`);
  }

  const { error: appointmentError } = await client.from("appointments").insert({
    tenant_id: patient.tenant_id,
    patient_id: patient.id,
    doctor_id: doctor.id,
    appointment_date: formatDatetimeLocal(input.appointmentDate),
    duration_minutes: 30,
    type: input.type ?? "checkup",
    status: "scheduled",
  });

  if (!appointmentError) {
    throw new Error("Expected appointment conflict but insert succeeded");
  }

  if (appointmentError.code !== "23P01") {
    throw appointmentError;
  }
}

export async function expectAppointmentConflict(page: Page) {
  await expect(
    page.getByText(/Appointment overlaps with an existing booking|Appointment conflict detected/i).first(),
  ).toBeVisible({ timeout: 30_000 });
}

export async function closeOpenDialog(page: Page) {
  const dialog = page.getByRole("dialog").last();
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole("button", { name: /cancel/i }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
}
