import { reportError } from "@/core/observability/logger";
import { createRequestId } from "@/core/observability/requestId";
import type { DomainEvent, DomainEventMetadata, DomainEventName, DomainEventPayloads } from "./event-types";
import { domainEventRepository } from "@/services/events/domainEvent.repository";

const EVENT_ENTITY_MAP: Record<DomainEventName, { entityType: string; entityIdKey: keyof DomainEventPayloads[DomainEventName] }> = {
  AppointmentCreated: { entityType: "appointment", entityIdKey: "appointmentId" },
  InvoicePaid: { entityType: "invoice", entityIdKey: "invoiceId" },
  LabResultUploaded: { entityType: "lab_order", entityIdKey: "labOrderId" },
  PrescriptionIssued: { entityType: "prescription", entityIdKey: "prescriptionId" },
  PatientRegistered: { entityType: "patient", entityIdKey: "patientId" },
};

type EventHandler<TName extends DomainEventName> = (event: DomainEvent<TName>) => void | Promise<void>;

class EventBus {
  private handlers = new Map<DomainEventName, Set<EventHandler<DomainEventName>>>();

  on<TName extends DomainEventName>(name: TName, handler: EventHandler<TName>) {
    const current = this.handlers.get(name) ?? new Set();
    current.add(handler as EventHandler<DomainEventName>);
    this.handlers.set(name, current);
    return () => current.delete(handler as EventHandler<DomainEventName>);
  }

  async emit<TName extends DomainEventName>(event: DomainEvent<TName>) {
    const handlers = this.handlers.get(event.name);
    if (!handlers || handlers.size === 0) return;
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        await reportError(err, { action: "event_handler_failed", resourceType: event.name });
      }
    }
  }
}

export const eventBus = new EventBus();

export async function emitDomainEvent<TName extends DomainEventName>(
  name: TName,
  payload: DomainEventPayloads[TName],
  metadata: Omit<DomainEventMetadata, "occurredAt"> & { occurredAt?: string },
) {
  const event: DomainEvent<TName> = {
    name,
    payload,
    metadata: {
      tenantId: metadata.tenantId,
      userId: metadata.userId ?? null,
      requestId: metadata.requestId ?? createRequestId(),
      occurredAt: metadata.occurredAt ?? new Date().toISOString(),
    },
  };

  try {
    const mapping = EVENT_ENTITY_MAP[name];
    const entityId = mapping ? (payload as Record<string, string>)[mapping.entityIdKey as string] ?? null : null;
    await domainEventRepository.insert({
      event_type: name,
      event_version: 1,
      entity_type: mapping?.entityType ?? name,
      entity_id: entityId,
      tenant_id: event.metadata.tenantId,
      payload: payload as Record<string, unknown>,
    });
  } catch (err) {
    await reportError(err, { action: "event_store_failed", resourceType: name });
  }

  await eventBus.emit(event);
}
