import { beforeEach, describe, expect, it, vi } from "vitest";

const portalRepository = vi.hoisted(() => ({
  getLoginMetadata: vi.fn(),
  sendMagicLink: vi.fn(),
  getAccountByAuthUserId: vi.fn(),
  listAppointments: vi.fn(),
  listPrescriptions: vi.fn(),
  listLabOrders: vi.fn(),
  listDocuments: vi.fn(),
  listInvoices: vi.fn(),
}));

vi.mock("@/services/portal/portal.repository", () => ({ portalRepository }));

import { portalService } from "@/services/portal/portal.service";

describe("portalService", () => {
  const clinicSlug = "clinic-demo";
  const email = "patient@example.com";
  const redirectTo = "https://app.example.com/portal/clinic-demo";
  const userId = "00000000-0000-0000-0000-000000000111";
  const patientId = "00000000-0000-0000-0000-000000000222";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks magic link requests when no active portal invite exists", async () => {
    portalRepository.getLoginMetadata.mockResolvedValue(null);

    await expect(portalService.sendMagicLink({ clinicSlug, email, redirectTo })).rejects.toThrow(
      "No portal invite found for this email",
    );

    expect(portalRepository.sendMagicLink).not.toHaveBeenCalled();
  });

  it("sends a magic link when login metadata is valid", async () => {
    portalRepository.getLoginMetadata.mockResolvedValue({
      tenant_id: "00000000-0000-0000-0000-000000000333",
      patient_id: patientId,
    });
    portalRepository.sendMagicLink.mockResolvedValue(undefined);

    await portalService.sendMagicLink({ clinicSlug, email, redirectTo });

    expect(portalRepository.getLoginMetadata).toHaveBeenCalledWith(clinicSlug, email);
    expect(portalRepository.sendMagicLink).toHaveBeenCalledWith(email, redirectTo);
  });

  it("rejects non-uuid portal account lookups before hitting the repository", async () => {
    await expect(portalService.getAccountByAuthUserId("not-a-uuid")).rejects.toThrow();
    expect(portalRepository.getAccountByAuthUserId).not.toHaveBeenCalled();
  });

  it("rejects non-uuid patient ids for invoice access", async () => {
    await expect(portalService.listInvoices("not-a-uuid")).rejects.toThrow();
    expect(portalRepository.listInvoices).not.toHaveBeenCalled();
  });

  it("passes parsed patient ids through to the repository", async () => {
    portalRepository.listAppointments.mockResolvedValue([]);

    await portalService.listAppointments(patientId);

    expect(portalRepository.listAppointments).toHaveBeenCalledWith(patientId);
  });
});
