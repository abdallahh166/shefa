import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/core/auth/authStore";
import { userPreferencesService } from "@/services/settings/userPreferences.service";
import {
  DEFAULT_LOCALE,
  DEFAULT_NAMESPACE,
  ensureNamespaces,
  getDefaultCalendar,
  getLoadedNamespaces,
  getLocaleDirection,
  i18n,
  initializeI18n,
  normalizeLocale,
  translatePath,
  type CalendarType,
  type Direction,
  type Locale,
  type TranslationNamespace,
} from "./config";

type StoredPreferences = {
  locale?: Locale;
  calendarType?: CalendarType;
};

interface I18nStoreState {
  locale: Locale;
  dir: Direction;
  calendarType: CalendarType;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setLocale: (locale: Locale) => void;
  setCalendarType: (calendarType: CalendarType) => void;
}

const STORAGE_PREFIX = "medflow:i18n";
const LEGACY_STORAGE_KEY = "medflow-i18n";

function getEffectiveScope() {
  const { user, tenantOverride } = useAuth.getState();
  return {
    tenantId: tenantOverride?.id ?? user?.tenantId ?? "public",
    userId: user?.id ?? "anon",
  };
}

function getScopedStorageKey() {
  const { tenantId, userId } = getEffectiveScope();
  return `${STORAGE_PREFIX}:${tenantId}:${userId}`;
}

function readScopedPreferences(): StoredPreferences {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const scoped = window.localStorage.getItem(getScopedStorageKey());
    if (scoped) {
      return JSON.parse(scoped) as StoredPreferences;
    }

    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) {
      return {};
    }

    const parsed = JSON.parse(legacy) as {
      state?: { locale?: Locale; calendarType?: CalendarType };
    };

    return {
      locale: parsed.state?.locale,
      calendarType: parsed.state?.calendarType,
    };
  } catch {
    return {};
  }
}

function writeScopedPreferences(preferences: StoredPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getScopedStorageKey(),
      JSON.stringify(preferences),
    );
  } catch {
    // Ignore local persistence failures.
  }
}

function normalizeCalendarType(
  locale: Locale,
  calendarType?: CalendarType,
): CalendarType {
  if (calendarType === "gregorian" || calendarType === "hijri") {
    return calendarType;
  }

  return getDefaultCalendar(locale);
}

async function readRemoteLocale() {
  const userId = useAuth.getState().user?.id;
  if (!userId) {
    return undefined;
  }

  try {
    const preferences = await userPreferencesService.getByUserId(userId);
    return preferences?.locale ?? undefined;
  } catch {
    return undefined;
  }
}

function persistCurrentState(locale: Locale, calendarType: CalendarType) {
  writeScopedPreferences({ locale, calendarType });
}

export const useI18nStore = create<I18nStoreState>((set, get) => ({
  locale: DEFAULT_LOCALE,
  dir: getLocaleDirection(DEFAULT_LOCALE),
  calendarType: getDefaultCalendar(DEFAULT_LOCALE),
  isHydrated: false,
  hydrate: async () => {
    const localPreferences = readScopedPreferences();
    const remoteLocale = await readRemoteLocale();
    const locale = normalizeLocale(
      remoteLocale ?? localPreferences.locale ?? i18n.resolvedLanguage,
    );
    const calendarType = normalizeCalendarType(
      locale,
      localPreferences.calendarType,
    );

    await initializeI18n(locale);
    persistCurrentState(locale, calendarType);

    set({
      locale,
      dir: getLocaleDirection(locale),
      calendarType,
      isHydrated: true,
    });
  },
  setLocale: (nextLocale) => {
    const locale = normalizeLocale(nextLocale);
    const calendarType = get().calendarType;

    set({
      locale,
      dir: getLocaleDirection(locale),
    });
    persistCurrentState(locale, calendarType);

    void (async () => {
      await initializeI18n(locale);
      await ensureNamespaces(getLoadedNamespaces());
    })();

    const userId = useAuth.getState().user?.id;
    if (userId) {
      void userPreferencesService.setLocale(userId, locale).catch(() => undefined);
    }
  },
  setCalendarType: (nextCalendarType) => {
    const locale = get().locale;
    const calendarType = normalizeCalendarType(locale, nextCalendarType);
    set({ calendarType });
    persistCurrentState(locale, calendarType);
  },
}));

let lastScopeKey = getScopedStorageKey();

useAuth.subscribe(() => {
  const nextScopeKey = getScopedStorageKey();
  if (nextScopeKey === lastScopeKey) {
    return;
  }

  lastScopeKey = nextScopeKey;
  void useI18nStore.getState().hydrate();
});

export function initializeI18nStore() {
  return useI18nStore.getState().hydrate();
}

export function useI18n(
  namespaces: readonly TranslationNamespace[] = [DEFAULT_NAMESPACE],
) {
  const locale = useI18nStore((state) => state.locale);
  const dir = useI18nStore((state) => state.dir);
  const calendarType = useI18nStore((state) => state.calendarType);
  const setLocale = useI18nStore((state) => state.setLocale);
  const setCalendarType = useI18nStore((state) => state.setCalendarType);
  const isHydrated = useI18nStore((state) => state.isHydrated);
  const { i18n: boundI18n } = useTranslation();

  const namespaceKey = namespaces.join("|");

  useEffect(() => {
    void ensureNamespaces(namespaces);
  }, [namespaceKey, namespaces]);

  const t = useMemo(
    () =>
      (path: string, options?: Record<string, unknown>) =>
        translatePath(path, options),
    [boundI18n.language, locale],
  );

  return {
    i18n: boundI18n,
    locale,
    dir,
    calendarType,
    isHydrated,
    setLocale,
    setCalendarType,
    t,
  };
}

export type { CalendarType, Locale, TranslationNamespace };
