import type { AppointmentQueue, AppointmentQueueWithRelations, AppointmentQueueStatus } from "@/domain/appointmentQueue/appointmentQueue.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";
import { assertOk } from "@/services/supabase/query";

const APPOINTMENT_QUEUE_COLUMNS =
  "id, appointment_id, tenant_id, check_in_at, position, status, called_at, completed_at, created_at";
const APPOINTMENT_QUEUE_WITH_RELATIONS_COLUMNS =
  `${APPOINTMENT_QUEUE_COLUMNS}, appointments!inner(id, appointment_date, duration_minutes, type, status, patients(full_name), doctors(full_name))`;

export interface AppointmentQueueRepository {
  listByCheckInRange(start: string, end: string, tenantId: string): Promise<AppointmentQueueWithRelations[]>;
  getById(id: string, tenantId: string): Promise<AppointmentQueue | null>;
  getByAppointmentId(appointmentId: string, tenantId: string): Promise<AppointmentQueue | null>;
  create(
    input: { appointment_id: string; status?: AppointmentQueueStatus; position?: number | null },
    tenantId: string,
  ): Promise<AppointmentQueue>;
  update(
    id: string,
    input: {
      status?: AppointmentQueueStatus;
      position?: number | null;
      called_at?: string | null;
      completed_at?: string | null;
    },
    tenantId: string,
  ): Promise<AppointmentQueue>;
}

export const appointmentQueueRepository: AppointmentQueueRepository = {
  async listByCheckInRange(start, end, tenantId) {
    const { data, error } = await supabase
      .from("appointment_queue")
      .select(APPOINTMENT_QUEUE_WITH_RELATIONS_COLUMNS)
      .eq("tenant_id", tenantId)
      .gte("check_in_at", start)
      .lte("check_in_at", end)
      .order("check_in_at", { ascending: true });

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load waiting room queue", {
        code: error.code,
        details: error,
      });
    }

    return (data ?? []) as AppointmentQueueWithRelations[];
  },
  async getById(id, tenantId) {
    const { data, error } = await supabase
      .from("appointment_queue")
      .select(APPOINTMENT_QUEUE_COLUMNS)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load queue entry", {
        code: error.code,
        details: error,
      });
    }

    return (data ?? null) as AppointmentQueue | null;
  },
  async getByAppointmentId(appointmentId, tenantId) {
    const { data, error } = await supabase
      .from("appointment_queue")
      .select(APPOINTMENT_QUEUE_COLUMNS)
      .eq("appointment_id", appointmentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load appointment queue entry", {
        code: error.code,
        details: error,
      });
    }

    return (data ?? null) as AppointmentQueue | null;
  },
  async create(input, tenantId) {
    const payload: Record<string, unknown> = {
      appointment_id: input.appointment_id,
      tenant_id: tenantId,
    };

    if (input.status !== undefined) payload.status = input.status;
    if (input.position !== undefined) payload.position = input.position;

    const result = await supabase
      .from("appointment_queue")
      .insert(payload as any)
      .select(APPOINTMENT_QUEUE_COLUMNS)
      .single();

    return assertOk(result) as AppointmentQueue;
  },
  async update(id, input, tenantId) {
    const payload: Record<string, unknown> = {};

    if (input.status !== undefined) payload.status = input.status;
    if (input.position !== undefined) payload.position = input.position;
    if (input.called_at !== undefined) payload.called_at = input.called_at;
    if (input.completed_at !== undefined) payload.completed_at = input.completed_at;

    const result = await supabase
      .from("appointment_queue")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(APPOINTMENT_QUEUE_COLUMNS)
      .single();

    return assertOk(result) as AppointmentQueue;
  },
};
