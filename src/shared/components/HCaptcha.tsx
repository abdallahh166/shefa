import { useEffect, useRef } from "react";

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: HTMLElement, params: Record<string, unknown>) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

type HCaptchaProps = {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  className?: string;
};

export const HCaptcha = ({ siteKey, onVerify, onExpire, className }: HCaptchaProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;

    const renderCaptcha = () => {
      if (cancelled || !containerRef.current || !window.hcaptcha) return;
      if (widgetIdRef.current !== null) {
        window.hcaptcha.reset(widgetIdRef.current);
        return;
      }

      widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onVerify(token),
        "expired-callback": () => {
          onVerify("");
          onExpire?.();
        },
        "error-callback": () => {
          onVerify("");
        },
      });
    };

    if (window.hcaptcha) {
      renderCaptcha();
    } else {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://js.hcaptcha.com/1/api.js"]',
      );
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://js.hcaptcha.com/1/api.js";
        script.async = true;
        script.defer = true;
        script.onload = () => renderCaptcha();
        document.body.appendChild(script);
      } else {
        const interval = window.setInterval(() => {
          if (window.hcaptcha) {
            window.clearInterval(interval);
            renderCaptcha();
          }
        }, 100);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [siteKey, onVerify, onExpire]);

  return <div className={className} ref={containerRef} />;
};
