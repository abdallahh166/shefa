import { test, expect } from "@playwright/test";
import { createAppointment, createPatient, getClinicConfig, hasClinicConfig, loginToClinic } from "./helpers/clinic";

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
    await createAppointment(page, config, { patientName, appointmentDate });

    await expect(page.getByText(patientName).first()).toBeVisible({ timeout: 30_000 });
  });
});
