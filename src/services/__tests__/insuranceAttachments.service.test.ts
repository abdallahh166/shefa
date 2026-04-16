import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { insuranceAttachmentsService } from "@/services/insurance/insuranceAttachments.service";
import { insuranceAttachmentsRepository } from "@/services/insurance/insuranceAttachments.repository";
import {
  uploadInsuranceAttachment,
  removeInsuranceAttachment,
} from "@/services/insurance/insuranceAttachments.storage";

vi.mock("@/services/supabase/tenant", () => ({
  getTenantContext: () => ({ tenantId: "00000000-0000-0000-0000-000000000111", userId: "00000000-0000-0000-0000-000000000222" }),
}));

vi.mock("@/core/auth/authStore", () => ({
  useAuth: {
    getState: () => ({
      hasPermission: () => true,
    }),
  },
}));

vi.mock("@/services/insurance/insuranceAttachments.repository", () => ({
  insuranceAttachmentsRepository: {
    createMetadata: vi.fn(),
    listByClaim: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@/services/insurance/insuranceAttachments.storage", () => ({
  uploadInsuranceAttachment: vi.fn(),
  removeInsuranceAttachment: vi.fn(),
  downloadInsuranceAttachment: vi.fn(),
}));

vi.mock("@/services/security/rateLimit.service", () => ({
  rateLimitService: {
    assertAllowed: vi.fn(),
  },
}));

const repo = vi.mocked(insuranceAttachmentsRepository, true);
const storageUpload = vi.mocked(uploadInsuranceAttachment, true);
const storageRemove = vi.mocked(removeInsuranceAttachment, true);

class FileMock {
  name: string;
  type: string;
  size: number;

  constructor(parts: Array<string | ArrayBuffer>, name: string, options?: { type?: string }) {
    this.name = name;
    this.type = options?.type ?? "";
    this.size = parts.reduce((acc, part) => {
      if (typeof part === "string") return acc + part.length;
      return acc + part.byteLength;
    }, 0);
  }
}

beforeAll(() => {
  (globalThis as unknown as { File?: typeof FileMock }).File = FileMock as unknown as typeof File;
});

describe("insuranceAttachmentsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads attachment and stores metadata", async () => {
    storageUpload.mockResolvedValue({
      filePath: "00000000-0000-0000-0000-000000000111/insurance-claims/c1/eob.pdf",
      fileName: "eob.pdf",
      fileSize: 10,
      fileType: "application/pdf",
    });

    repo.createMetadata.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000009999",
      claim_id: "00000000-0000-0000-0000-000000000333",
      tenant_id: "00000000-0000-0000-0000-000000000111",
      file_name: "eob.pdf",
      file_path: "00000000-0000-0000-0000-000000000111/insurance-claims/c1/eob.pdf",
      file_size: 10,
      file_type: "application/pdf",
      attachment_type: "eob",
      uploaded_by: "00000000-0000-0000-0000-000000000222",
      notes: "payer remittance",
      deleted_at: null,
      deleted_by: null,
      created_at: "2026-04-16T10:00:00Z",
    });

    const file = new FileMock(["content"], "eob.pdf", { type: "application/pdf" }) as unknown as File;
    const result = await insuranceAttachmentsService.upload({
      claim_id: "00000000-0000-0000-0000-000000000333",
      attachment_type: "eob",
      file,
      notes: "payer remittance",
    });

    expect(storageUpload).toHaveBeenCalledWith({
      tenantId: "00000000-0000-0000-0000-000000000111",
      claimId: "00000000-0000-0000-0000-000000000333",
      file,
    });
    expect(repo.createMetadata).toHaveBeenCalled();
    expect(result.file_name).toBe("eob.pdf");
  });

  it("cleans up storage if metadata creation fails", async () => {
    storageUpload.mockResolvedValue({
      filePath: "00000000-0000-0000-0000-000000000111/insurance-claims/c1/eob.pdf",
      fileName: "eob.pdf",
      fileSize: 10,
      fileType: "application/pdf",
    });
    storageRemove.mockResolvedValue(undefined);
    repo.createMetadata.mockRejectedValue(new Error("db failed"));

    const file = new FileMock(["content"], "eob.pdf", { type: "application/pdf" }) as unknown as File;
    await expect(
      insuranceAttachmentsService.upload({
        claim_id: "00000000-0000-0000-0000-000000000333",
        attachment_type: "eob",
        file,
      }),
    ).rejects.toThrow("db failed");

    expect(storageRemove).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000111",
      "00000000-0000-0000-0000-000000000111/insurance-claims/c1/eob.pdf",
    );
  });

  it("returns storage error details when cleanup fails", async () => {
    repo.remove.mockResolvedValue({
      file_path: "00000000-0000-0000-0000-000000000111/insurance-claims/c1/eob.pdf",
    });
    storageRemove.mockRejectedValue(new Error("storage failed"));

    const result = await insuranceAttachmentsService.remove("00000000-0000-0000-0000-000000009999");
    expect(result).toEqual({ storageError: "storage failed" });
  });

  it("rejects unsupported attachment types", async () => {
    const file = new FileMock(["content"], "script.exe", { type: "application/x-msdownload" }) as unknown as File;

    await expect(
      insuranceAttachmentsService.upload({
        claim_id: "00000000-0000-0000-0000-000000000333",
        attachment_type: "other",
        file,
      }),
    ).rejects.toThrow("Unsupported attachment type");
  });
});
