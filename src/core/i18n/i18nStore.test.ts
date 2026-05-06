import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "@/core/auth/authStore";
import { ensureNamespaces, initializeI18n, translatePath } from "./config";
import { useI18nStore } from "./i18nStore";

describe("i18n store", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("lang");
    document.documentElement.removeAttribute("dir");
    delete document.documentElement.dataset.font;

    await initializeI18n("en");

    useI18nStore.setState({
      locale: "en",
      dir: "ltr",
      calendarType: "gregorian",
      isHydrated: true,
    });

    useAuth.setState({
      user: {
        id: "user-1",
        name: "Test User",
        email: "user@example.com",
        tenantId: "tenant-1",
        tenantSlug: "tenant-1",
        tenantName: "Tenant 1",
        tenantStatus: "active",
        tenantRoles: ["clinic_admin"],
        globalRoles: [],
      },
      tenantOverride: null,
    });
  });

  it("updates document language metadata for RTL locales", async () => {
    await initializeI18n("ar");
    await ensureNamespaces(["portal", "common"]);

    expect(document.documentElement.lang).toBe("ar-EG");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.dataset.font).toBe("arabic");
    expect(translatePath("portal.layout.title")).toBe("بوابة المرضى");
    expect(translatePath("common.reload")).toBe("إعادة التحميل");
  });

  it("loads feature namespaces lazily", async () => {
    await ensureNamespaces(["portal"]);

    expect(translatePath("portal.layout.signOut")).toBe("Sign out");
  });

  it("supports ICU pluralization and interpolation in feature namespaces", async () => {
    await ensureNamespaces(["admin"]);

    expect(translatePath("admin.common.activeAlerts", { count: 1 })).toBe(
      "1 active alert",
    );
    expect(translatePath("admin.common.activeAlerts", { count: 3 })).toBe(
      "3 active alerts",
    );
    expect(
      translatePath("admin.tenantForm.editTitle", {
        name: "Cairo Heart Clinic",
      }),
    ).toBe("Edit Cairo Heart Clinic");
  });

  it("keeps local calendar state when switching languages", () => {
    act(() => {
      useI18nStore.getState().setCalendarType("hijri");
      useI18nStore.getState().setLocale("ar");
    });

    expect(useI18nStore.getState().calendarType).toBe("hijri");
    expect(useI18nStore.getState().locale).toBe("ar");
    expect(useI18nStore.getState().dir).toBe("rtl");
  });

  it("persists language with tenant and user scoped keys", () => {
    act(() => {
      useI18nStore.getState().setLocale("ar");
      useI18nStore.getState().setCalendarType("hijri");
    });

    expect(window.localStorage.getItem("lang:tenant-1:user-1")).toBe("ar");
    expect(window.localStorage.getItem("calendar:tenant-1:user-1")).toBe(
      "hijri",
    );
  });
});
