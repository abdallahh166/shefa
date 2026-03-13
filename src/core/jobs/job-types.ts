export type JobName =
  | "SendAppointmentNotifications"
  | "GenerateMonthlyReports"
  | "RefreshMaterializedViews"
  | "ProcessInsuranceClaims"
  | "SendInvoiceEmails";

export type JobDefinition<TPayload = Record<string, unknown>> = {
  name: JobName;
  maxRetries: number;
  backoffMs: number;
  payload?: TPayload;
};
