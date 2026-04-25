import { test, expect } from "@playwright/test";
import { createPatient, getClinicConfig, hasClinicConfig, loginToClinic, seedAppointment } from "./helpers/clinic";

test.describe("clinic smoke flow", () => {
  test("login, create patient, create appointment", async ({ page }) => {
    const config = getClinicConfig();
    test.skip(!hasClinicConfig(config), "E2E credentials not configured");

    const patientName = `E2E Patient ${Date.now()}`;
    const appointmentDate = new Date();
    appointmentDate.setDate(appointmentDate.getDate() + 1);
    appointmentDate.setHours(9, 0, 0, 0);

    await loginToClinic(page, config);
    await createPatient(page, config.clinicSlug!, patientName);
    await seedAppointment(config, { patientName, appointmentDate });

    await page.goto(`/tenant/${config.clinicSlug}/appointments`);
    await expect(page.getByText(patientName).first()).toBeVisible({ timeout: 30_000 });
  });
});
