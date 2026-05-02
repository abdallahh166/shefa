import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const fileChecks = [
  {
    file: "src/features/portal/PortalLayout.tsx",
    phrases: ["Patient Portal", "Sign out", "Dashboard", "Appointments"],
  },
  {
    file: "src/features/portal/PortalPages.tsx",
    phrases: ["No appointments yet.", "No invoices yet.", "Void reason:", "Settled "],
  },
  {
    file: "src/pages/PortalLoginPage.tsx",
    phrases: ["Send magic link", "Sending...", "Email is required"],
  },
  {
    file: "src/pages/PricingPage.tsx",
    phrases: ["Choose the plan that fits your clinic", "Contact us", "Request upgrade"],
  },
  {
    file: "src/features/settings/tabs/SubscriptionTab.tsx",
    phrases: ["Subscription Management", "Renew now", "View all plans"],
  },
  {
    file: "src/shared/components/DataTable.tsx",
    phrases: ["Data table"],
  },
  {
    file: "src/features/patients/AddPatientModal.tsx",
    phrases: ["Name required", "Patient added successfully", "Failed to add patient"],
  },
  {
    file: "src/features/patients/PatientsPage.tsx",
    phrases: ["total patients", "Patient List", "Failed to delete patients"],
  },
  {
    file: "src/features/appointments/NewAppointmentModal.tsx",
    phrases: ["Duration (min)"],
  },
  {
    file: "src/features/billing/NewInvoiceModal.tsx",
    phrases: ["Cardiology Consultation", "Due date"],
  },
] as const;

describe("i18n hygiene", () => {
  it("removes hardcoded user-facing strings from migrated surfaces", () => {
    for (const check of fileChecks) {
      const content = readFileSync(resolve(check.file), "utf8");
      for (const phrase of check.phrases) {
        expect(content).not.toContain(phrase);
      }
    }
  });
});
