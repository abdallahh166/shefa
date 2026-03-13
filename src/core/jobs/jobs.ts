import type { JobDefinition, JobName } from "./job-types";

export const JOB_DEFAULTS: Record<JobName, Omit<JobDefinition, "name">> = {
  SendAppointmentNotifications: { maxRetries: 2, backoffMs: 2000 },
  GenerateMonthlyReports: { maxRetries: 2, backoffMs: 3000 },
  RefreshMaterializedViews: { maxRetries: 1, backoffMs: 2000 },
  ProcessInsuranceClaims: { maxRetries: 3, backoffMs: 3000 },
  SendInvoiceEmails: { maxRetries: 2, backoffMs: 2000 },
};

export function buildJob(name: JobName, payload?: Record<string, unknown>): JobDefinition {
  return {
    name,
    payload,
    ...JOB_DEFAULTS[name],
  };
}
