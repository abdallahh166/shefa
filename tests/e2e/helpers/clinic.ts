import { expect, Page } from "@playwright/test";

export type E2EClinicConfig = {
  adminEmail?: string;
  adminPassword?: string;
  clinicSlug?: string;
  doctorName?: string;
};

export function getClinicConfig(): E2EClinicConfig {
  return {
    adminEmail: process.env.E2E_ADMIN_EMAIL,
    adminPassword: process.env.E2E_ADMIN_PASSWORD,
    clinicSlug: process.env.E2E_CLINIC_SLUG,
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
  await page.waitForURL(`**/tenant/${config.clinicSlug}/dashboard`, { timeout: 30_000 });
}

export async function createPatient(page: Page, clinicSlug: string, patientName: string) {
  await page.goto(`/tenant/${clinicSlug}/patients`);
  await page.getByTestId("patients-add-button").click();
  await page.getByTestId("patient-full-name").fill(patientName);
  await page.getByTestId("patient-save").click();
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
  },
) {
  if (!config.clinicSlug) throw new Error("E2E clinic slug is missing");

  await page.goto(`/tenant/${config.clinicSlug}/appointments`);
  await page.getByTestId("appointments-add-button").click();

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

  await page.getByTestId("appointment-save").click();

  return {
    doctorName: selectedDoctorName,
    appointmentDate: formatDatetimeLocal(input.appointmentDate),
  };
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
