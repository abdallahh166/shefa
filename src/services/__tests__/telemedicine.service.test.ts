import { beforeEach, describe, expect, it, vi } from "vitest";

const telemedicineRepository = vi.hoisted(() => ({
  getAgoraToken: vi.fn(),
}));

vi.mock("@/services/telemedicine/telemedicine.repository", () => ({ telemedicineRepository }));

import { telemedicineService } from "@/services/telemedicine/telemedicine.service";

describe("telemedicineService", () => {
  const appointmentId = "00000000-0000-0000-0000-000000000111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid appointment ids before requesting a token", async () => {
    await expect(telemedicineService.getAgoraToken("bad-id")).rejects.toThrow();
    expect(telemedicineRepository.getAgoraToken).not.toHaveBeenCalled();
  });

  it("returns parsed agora token payloads", async () => {
    telemedicineRepository.getAgoraToken.mockResolvedValue({
      appId: "agora-app",
      channel: "appointment-111",
      token: "signed-token",
      uid: 42,
    });

    const result = await telemedicineService.getAgoraToken(appointmentId);

    expect(telemedicineRepository.getAgoraToken).toHaveBeenCalledWith(appointmentId);
    expect(result.uid).toBe(42);
    expect(result.channel).toBe("appointment-111");
  });

  it("rejects malformed agora token payloads", async () => {
    telemedicineRepository.getAgoraToken.mockResolvedValue({
      appId: "agora-app",
      channel: "",
      token: "signed-token",
      uid: -1,
    });

    await expect(telemedicineService.getAgoraToken(appointmentId)).rejects.toThrow();
  });
});
