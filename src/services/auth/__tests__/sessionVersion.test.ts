import { describe, expect, it } from "vitest";
import { assuranceToTag, computeSessionVersion, sessionVersionFromSupabaseUser } from "../sessionVersion";

describe("sessionVersion", () => {
  it("maps assurance levels to tags", () => {
    expect(assuranceToTag("aal2")).toBe("2");
    expect(assuranceToTag("aal1")).toBe("1");
    expect(assuranceToTag(null)).toBe("0");
  });

  it("computeSessionVersion includes assurance segment", () => {
    expect(
      computeSessionVersion({
        userId: "u1",
        tenantId: "t1",
        sessionCreatedAtSec: 100,
        assurance: "2",
      }),
    ).toBe("u1:t1:100:2");
  });

  it("sessionVersionFromSupabaseUser uses user created_at and assurance", () => {
    const user = { id: "user-1", created_at: "2020-01-01T00:00:00.000Z" } as any;
    const sec = Math.floor(new Date("2020-01-01T00:00:00.000Z").getTime() / 1000);
    expect(sessionVersionFromSupabaseUser(user, "tenant-1", null, "aal2")).toBe(`user-1:tenant-1:${sec}:2`);
    expect(sessionVersionFromSupabaseUser(user, null, null, undefined)).toBe(`user-1:none:${sec}:0`);
  });
});
