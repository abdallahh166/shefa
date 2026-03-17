import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const client = createClient(supabaseUrl, serviceRoleKey);

const APPOINTMENT_COUNT = Number.parseInt(process.env.APPOINTMENTS ?? "1000", 10);
const REMINDER_COUNT = Number.parseInt(process.env.REMINDERS ?? "200", 10);
const PORTAL_LOGINS = Number.parseInt(process.env.PORTAL_LOGINS ?? "50", 10);
const BATCH_SIZE = 100;

async function resolveTenantId() {
  if (process.env.TENANT_ID) return process.env.TENANT_ID;
  const { data, error } = await client.from("tenants").select("id").limit(1).maybeSingle();
  if (error || !data?.id) throw new Error("Unable to resolve TENANT_ID. Set TENANT_ID env var.");
  return data.id;
}

async function resolvePatientId(tenantId) {
  if (process.env.PATIENT_ID) return process.env.PATIENT_ID;
  const { data, error } = await client
    .from("patients")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  if (error || !data?.id) throw new Error("Unable to resolve PATIENT_ID. Set PATIENT_ID env var.");
  return data.id;
}

async function resolveDoctorId(tenantId) {
  if (process.env.DOCTOR_ID) return process.env.DOCTOR_ID;
  const { data, error } = await client
    .from("doctors")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  if (error || !data?.id) throw new Error("Unable to resolve DOCTOR_ID. Set DOCTOR_ID env var.");
  return data.id;
}

async function insertInBatches(table, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await client.from(table).insert(batch);
    if (error) throw error;
  }
}

async function main() {
  const tenantId = await resolveTenantId();
  const patientId = await resolvePatientId(tenantId);
  const doctorId = await resolveDoctorId(tenantId);

  console.log(`Using tenant=${tenantId} patient=${patientId} doctor=${doctorId}`);

  const now = new Date();
  const appointments = [];
  for (let i = 0; i < APPOINTMENT_COUNT; i += 1) {
    const scheduledAt = new Date(now.getTime() + i * 45 * 60 * 1000);
    appointments.push({
      tenant_id: tenantId,
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_date: scheduledAt.toISOString(),
      duration_minutes: 30,
      type: "checkup",
      status: "scheduled",
    });
  }

  console.log(`Creating ${appointments.length} appointments...`);
  await insertInBatches("appointments", appointments);
  console.log("Appointments created.");

  const { data: apptIds } = await client
    .from("appointments")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(REMINDER_COUNT);

  const reminderRows = (apptIds ?? []).map((appt, idx) => ({
    tenant_id: tenantId,
    appointment_id: appt.id,
    patient_id: patientId,
    channel: "email",
    send_at: new Date(Date.now() + (idx + 1) * 60 * 1000).toISOString(),
    status: "pending",
  }));

  if (reminderRows.length > 0) {
    console.log(`Creating ${reminderRows.length} reminder queue rows...`);
    await insertInBatches("reminder_queue", reminderRows);
    console.log("Reminder queue rows created.");
  } else {
    console.log("No appointments found to seed reminder queue.");
  }

  const { data: portalAccounts } = await client
    .from("patient_accounts")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(PORTAL_LOGINS);

  if (portalAccounts && portalAccounts.length > 0) {
    const ids = portalAccounts.map((row) => row.id);
    const { error } = await client
      .from("patient_accounts")
      .update({ last_login_at: new Date().toISOString() })
      .in("id", ids);
    if (error) throw error;
    console.log(`Simulated ${ids.length} portal logins.`);
  } else {
    console.log("No portal accounts available to simulate logins.");
  }

  console.log("Load test seed completed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
