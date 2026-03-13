import { eventBus } from "./event-bus";

export async function initEventHandlers() {
  const on = eventBus.on.bind(eventBus);
  const [{ registerAuditHandlers }, { registerNotificationHandlers }, { registerAnalyticsHandlers }] = await Promise.all([
    import("./handlers/audit.handler"),
    import("./handlers/notifications.handler"),
    import("./handlers/analytics.handler"),
  ]);

  registerAuditHandlers(on);
  registerNotificationHandlers(on);
  registerAnalyticsHandlers(on);
}

export { emitDomainEvent } from "./event-bus";
export type { DomainEventName, DomainEvent } from "./event-types";
