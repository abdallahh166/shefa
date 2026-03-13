import type { DomainEvent, DomainEventName } from "../event-types";
import { enqueueJob, buildJob } from "@/core/jobs";
import { useAuth } from "@/core/auth/authStore";

const ANALYTICS_EVENTS: DomainEventName[] = [
  "AppointmentCreated",
  "InvoicePaid",
  "LabResultUploaded",
  "PrescriptionIssued",
  "PatientRegistered",
];

export function registerAnalyticsHandlers(
  on: (name: DomainEventName, handler: (event: DomainEvent) => void | Promise<void>) => void,
) {
  ANALYTICS_EVENTS.forEach((name) => {
    on(name, async (event) => {
      const role = useAuth.getState().user?.role ?? null;
      if (role && !["clinic_admin", "super_admin"].includes(role)) {
        return;
      }
      enqueueJob(
        buildJob("RefreshMaterializedViews", {
          tenant_id: event.metadata.tenantId,
          event: name,
        }),
      );
    });
  });
}
