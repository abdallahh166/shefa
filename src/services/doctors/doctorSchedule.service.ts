import { z } from "zod";
import { doctorScheduleSchema, doctorScheduleUpsertSchema } from "@/domain/doctor/doctorSchedule.schema";
import type { DoctorScheduleUpsertInput } from "@/domain/doctor/doctorSchedule.types";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import { ServiceError, toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { doctorScheduleRepository } from "./doctorSchedule.repository";

function normalizeTime(value: string) {
  return value.length > 5 ? value.slice(0, 5) : value;
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map((part) => Number.parseInt(part, 10));
  return hour * 60 + minute;
}

function assertNoOverlaps(rows: DoctorScheduleUpsertInput[]) {
  const active = rows.filter((row) => row.is_active);
  const byDay = new Map<number, DoctorScheduleUpsertInput[]>();

  for (const row of active) {
    const list = byDay.get(row.day_of_week) ?? [];
    list.push(row);
    byDay.set(row.day_of_week, list);
  }

  for (const [day, list] of byDay.entries()) {
    const sorted = [...list].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const current = sorted[i];
      if (timeToMinutes(current.start_time) < timeToMinutes(prev.end_time)) {
        throw new Error(`Schedule overlap detected for day ${day}`);
      }
    }
  }
}

function isScheduleOverlap(err: unknown) {
  if (!(err instanceof ServiceError)) return false;
  if (err.code === "23P01") return true;
  const message = `${err.message ?? ""}`;
  const detailsMessage =
    typeof (err.details as { message?: string } | undefined)?.message === "string"
      ? (err.details as { message: string }).message
      : "";
  return message.includes("doctor_schedules_no_overlap") || detailsMessage.includes("doctor_schedules_no_overlap");
}

export const doctorScheduleService = {
  async listByDoctor(doctorId: string) {
    try {
      const parsedId = uuidSchema.parse(doctorId);
      const { tenantId } = getTenantContext();
      const result = await doctorScheduleRepository.listByDoctor(parsedId, tenantId);
      const data = z.array(doctorScheduleSchema).parse(result);
      return data.map((row) => ({
        ...row,
        start_time: normalizeTime(row.start_time),
        end_time: normalizeTime(row.end_time),
      }));
    } catch (err) {
      throw toServiceError(err, "Failed to load doctor schedule");
    }
  },
  async save(doctorId: string, rows: DoctorScheduleUpsertInput[]) {
    try {
      const parsedId = uuidSchema.parse(doctorId);
      const parsedRows = z.array(doctorScheduleUpsertSchema).parse(rows);
      assertNoOverlaps(parsedRows);
      const { tenantId } = getTenantContext();
      const result = await doctorScheduleRepository.upsertMany(parsedId, parsedRows, tenantId);
      const data = z.array(doctorScheduleSchema).parse(result);
      return data.map((row) => ({
        ...row,
        start_time: normalizeTime(row.start_time),
        end_time: normalizeTime(row.end_time),
      }));
    } catch (err) {
      if (isScheduleOverlap(err)) {
        throw new ServiceError("Schedule overlaps with an existing time range", {
          code: "SCHEDULE_OVERLAP",
          details: err,
        });
      }
      throw toServiceError(err, "Failed to save doctor schedule");
    }
  },
};
