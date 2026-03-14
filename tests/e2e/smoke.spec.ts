import { test, expect } from "@playwright/test";

test.describe("clinic smoke flow", () => {
  test("login, create patient, create appointment", async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    const clinicSlug = process.env.E2E_CLINIC_SLUG;

    test.skip(!email || !password || !clinicSlug, "E2E credentials not configured");

    const patientName = `E2E Patient ${Date.now()}`;

    await page.goto("/login");
    await page.getByTestId("login-email").fill(email!);
    await page.getByTestId("login-password").fill(password!);
    await page.getByTestId("login-submit").click();

    await page.waitForURL(`**/tenant/${clinicSlug}/dashboard`, { timeout: 30_000 });

    await page.goto(`/tenant/${clinicSlug}/patients`);
    await page.getByTestId("patients-add-button").click();
    await page.getByTestId("patient-full-name").fill(patientName);
    await page.getByTestId("patient-save").click();
    await expect(page.getByText(patientName).first()).toBeVisible({ timeout: 30_000 });

    await page.goto(`/tenant/${clinicSlug}/appointments`);
    await page.getByTestId("appointments-add-button").click();
    await page.getByTestId("appointment-patient-search").fill(patientName);
    await page.waitForTimeout(500);
    await page.getByTestId("appointment-patient-select").selectOption({ label: patientName });

    const doctorSelect = page.getByTestId("appointment-doctor-select");
    const doctorOptions = await doctorSelect.locator("option").allTextContents();
    test.skip(doctorOptions.length <= 1, "No doctors available for scheduling");

    if (process.env.E2E_DOCTOR_NAME) {
      await doctorSelect.selectOption({ label: process.env.E2E_DOCTOR_NAME });
    } else {
      await doctorSelect.selectOption({ index: 1 });
    }

    const appointmentDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16);
    await page.getByTestId("appointment-date").fill(appointmentDate);
    await page.getByTestId("appointment-save").click();

    await expect(page.getByText(patientName).first()).toBeVisible({ timeout: 30_000 });
  });
});
