import { expect, test } from "@playwright/test";
import {
  closeOpenDialog,
  createAppointment,
  createPatient,
  dateKey,
  expectAppointmentConflict,
  getClinicConfig,
  hasClinicConfig,
  loginToClinic,
} from "./helpers/clinic";

test.describe("appointment lifecycle", () => {
  test("creates, blocks conflicts, reschedules, and completes an appointment", async ({ page }) => {
    const config = getClinicConfig();
    test.skip(!hasClinicConfig(config), "E2E credentials not configured");

    const patientName = `E2E Lifecycle ${Date.now()}`;
    const appointmentDate = new Date();
    appointmentDate.setDate(appointmentDate.getDate() + 2);
    appointmentDate.setHours(10, 0, 0, 0);

    const rescheduledDate = new Date(appointmentDate);
    rescheduledDate.setDate(rescheduledDate.getDate() + 1);

    await loginToClinic(page, config);
    await createPatient(page, config.clinicSlug!, patientName);

    const created = await createAppointment(page, config, {
      patientName,
      appointmentDate,
    });

    const appointmentRow = () => page.locator("tbody tr", { hasText: patientName }).first();

    await expect(page.getByText("Appointment created")).toBeVisible({ timeout: 30_000 });
    await expect(appointmentRow()).toBeVisible({ timeout: 30_000 });
    await expect(appointmentRow()).toContainText(patientName);

    await createAppointment(page, config, {
      patientName,
      appointmentDate,
      doctorName: created.doctorName,
    });

    await expectAppointmentConflict(page);
    await closeOpenDialog(page);

    await page.getByTestId("appointments-view-calendar").click();

    const calendarItem = page
      .locator('[data-testid^="appointment-calendar-item-"]', { hasText: patientName })
      .first();
    const targetDay = page.getByTestId(`appointment-calendar-day-${dateKey(rescheduledDate)}`);

    await expect(calendarItem).toBeVisible({ timeout: 30_000 });
    await expect(targetDay).toBeVisible({ timeout: 30_000 });

    await calendarItem.dragTo(targetDay);

    await expect(page.getByText("Appointment rescheduled")).toBeVisible({ timeout: 30_000 });
    await expect(
      page
        .getByTestId(`appointment-calendar-day-${dateKey(rescheduledDate)}`)
        .locator('[data-testid^="appointment-calendar-item-"]', { hasText: patientName })
        .first(),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("appointments-view-list").click();
    await expect(appointmentRow()).toBeVisible({ timeout: 30_000 });

    await appointmentRow().getByRole("button", { name: "Start" }).click();
    await expect(page.getByText("Appointment status updated")).toBeVisible({ timeout: 30_000 });
    await expect(appointmentRow()).toContainText("In Progress", { timeout: 30_000 });

    await appointmentRow().getByRole("button", { name: "Complete" }).click();
    await expect(page.getByText("Appointment status updated")).toBeVisible({ timeout: 30_000 });
    await expect(appointmentRow()).toContainText("Completed", { timeout: 30_000 });
  });
});
