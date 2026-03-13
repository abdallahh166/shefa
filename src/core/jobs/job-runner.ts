import { logInfo, logWarn, reportError } from "@/core/observability/logger";
import type { JobDefinition, JobName } from "./job-types";
import { jobService } from "@/services/jobs/job.service";

const DEFAULT_BACKOFF_MS = 2000;

const JOB_FUNCTIONS: Record<JobName, string> = {
  SendAppointmentNotifications: "send-appointment-notifications",
  GenerateMonthlyReports: "generate-monthly-reports",
  RefreshMaterializedViews: "refresh-materialized-views",
  ProcessInsuranceClaims: "process-insurance-claims",
  SendInvoiceEmails: "send-invoice-emails",
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runJob(def: JobDefinition) {
  let attempt = 0;
  const maxRetries = Math.max(0, def.maxRetries ?? 0);
  const backoff = def.backoffMs ?? DEFAULT_BACKOFF_MS;

  while (true) {
    try {
      attempt += 1;
      logInfo("Running job", { action: def.name, metadata: { attempt } });
      await jobService.invoke(JOB_FUNCTIONS[def.name], def.payload ?? {});
      logInfo("Job completed", { action: def.name });
      return;
    } catch (err) {
      logWarn("Job failed", { action: def.name, metadata: { attempt, error: String(err) } });
      if (attempt > maxRetries) {
        await reportError(err, { action: "job_failed", resourceType: def.name });
        throw err;
      }
      await sleep(backoff * attempt);
    }
  }
}

export function enqueueJob(def: JobDefinition) {
  void runJob(def);
}
