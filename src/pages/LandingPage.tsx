import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/core/i18n/i18nStore";
import { LanguageSwitcher } from "@/shared/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  CalendarCheck, Users, FlaskConical, Receipt, ShieldCheck, BarChart3,
  Check, ChevronDown, ChevronUp, Star, ArrowRight, Stethoscope, Zap,
  Globe, Lock, HeartPulse,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

export const LandingPage = () => {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const isAr = locale === "ar";

  const features = [
    { icon: CalendarCheck, title: t("landing.featureAppointments"), desc: t("landing.featureAppointmentsDesc") },
    { icon: Users, title: t("landing.featurePatients"), desc: t("landing.featurePatientsDesc") },
    { icon: Stethoscope, title: t("landing.featureDoctors"), desc: t("landing.featureDoctorsDesc") },
    { icon: FlaskConical, title: t("landing.featureLab"), desc: t("landing.featureLabDesc") },
    { icon: Receipt, title: t("landing.featureBilling"), desc: t("landing.featureBillingDesc") },
    { icon: BarChart3, title: t("landing.featureReports"), desc: t("landing.featureReportsDesc") },
  ];

  const steps = [
    { num: "01", title: t("landing.step1Title"), desc: t("landing.step1Desc"), icon: Zap },
    { num: "02", title: t("landing.step2Title"), desc: t("landing.step2Desc"), icon: Globe },
    { num: "03", title: t("landing.step3Title"), desc: t("landing.step3Desc"), icon: Lock },
  ];

  const testimonials = [
    { name: t("landing.testimonial1Name"), role: t("landing.testimonial1Role"), text: t("landing.testimonial1Text"), rating: 5 },
    { name: t("landing.testimonial2Name"), role: t("landing.testimonial2Role"), text: t("landing.testimonial2Text"), rating: 5 },
    { name: t("landing.testimonial3Name"), role: t("landing.testimonial3Role"), text: t("landing.testimonial3Text"), rating: 4 },
  ];

  const plans = [
    {
      name: t("landing.planFree"),
      price: t("landing.planFreePrice"),
      period: "",
      desc: t("landing.planFreeDesc"),
      features: [t("landing.planFreeF1"), t("landing.planFreeF2"), t("landing.planFreeF3"), t("landing.planFreeF4")],
      cta: t("landing.planFreeCta"),
      popular: false,
    },
    {
      name: t("landing.planPro"),
      price: t("landing.planProPrice"),
      period: t("landing.perMonth"),
      desc: t("landing.planProDesc"),
      features: [t("landing.planProF1"), t("landing.planProF2"), t("landing.planProF3"), t("landing.planProF4"), t("landing.planProF5")],
      cta: t("landing.planProCta"),
      popular: true,
    },
    {
      name: t("landing.planEnterprise"),
      price: t("landing.planEnterprisePrice"),
      period: t("landing.perMonth"),
      desc: t("landing.planEnterpriseDesc"),
      features: [t("landing.planEnterpriseF1"), t("landing.planEnterpriseF2"), t("landing.planEnterpriseF3"), t("landing.planEnterpriseF4"), t("landing.planEnterpriseF5"), t("landing.planEnterpriseF6")],
      cta: t("landing.planEnterpriseCta"),
      popular: false,
    },
  ];

  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const faqs = [
    { q: t("landing.faq1Q"), a: t("landing.faq1A") },
    { q: t("landing.faq2Q"), a: t("landing.faq2A") },
    { q: t("landing.faq3Q"), a: t("landing.faq3A") },
    { q: t("landing.faq4Q"), a: t("landing.faq4A") },
    { q: t("landing.faq5Q"), a: t("landing.faq5A") },
  ];

  return (
    <div className={cn("min-h-screen bg-background text-foreground", isAr && "direction-rtl")} dir={isAr ? "rtl" : "ltr"}>
      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold text-foreground">MedFlow</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t("landing.navFeatures")}</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">{t("landing.navHowItWorks")}</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">{t("landing.navPricing")}</a>
            <a href="#faq" className="hover:text-foreground transition-colors">{t("landing.navFaq")}</a>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" onClick={() => navigate("/login")}>{t("landing.signIn")}</Button>
            <Button onClick={() => navigate("/login")}>{t("landing.getStarted")}</Button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden py-24 md:py-36">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <span className="inline-flex items-center gap-2 rounded-full border bg-accent/30 px-4 py-1.5 text-xs font-semibold text-accent-foreground mb-6">
              <ShieldCheck className="h-3.5 w-3.5" /> {t("landing.heroBadge")}
            </span>
          </motion.div>
          <motion.h1
            className="mx-auto max-w-4xl text-4xl font-bold leading-tight md:text-6xl md:leading-tight text-foreground"
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
          >
            {t("landing.heroTitle")}
          </motion.h1>
          <motion.p
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl"
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
          >
            {t("landing.heroSubtitle")}
          </motion.p>
          <motion.div className="mt-10 flex items-center justify-center gap-4 flex-wrap" initial="hidden" animate="visible" variants={fadeUp} custom={3}>
            <Button size="lg" className="text-base px-8" onClick={() => navigate("/login")}>
              {t("landing.heroCta")} <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
              {t("landing.heroSecondary")}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-20 md:py-28 bg-muted/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold md:text-4xl text-foreground">{t("landing.featuresTitle")}</h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">{t("landing.featuresSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={i}
                className="group rounded-xl border bg-card p-6 hover:shadow-lg hover:border-primary/30 transition-all duration-300"
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
              >
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold md:text-4xl text-foreground">{t("landing.howItWorksTitle")}</h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">{t("landing.howItWorksSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {steps.map((step, i) => (
              <motion.div
                key={i} className="text-center"
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
              >
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold shadow-lg">
                  {step.num}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold md:text-4xl text-foreground">{t("landing.testimonialsTitle")}</h2>
            <p className="mt-4 text-muted-foreground text-lg">{t("landing.testimonialsSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((test, i) => (
              <motion.div
                key={i}
                className="rounded-xl border bg-card p-6 shadow-sm"
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: test.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-warning text-warning" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 italic leading-relaxed">"{test.text}"</p>
                <div>
                  <p className="font-semibold text-foreground">{test.name}</p>
                  <p className="text-sm text-muted-foreground">{test.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold md:text-4xl text-foreground">{t("landing.pricingTitle")}</h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">{t("landing.pricingSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                className={cn(
                  "relative rounded-2xl border p-8 flex flex-col",
                  plan.popular
                    ? "border-primary shadow-xl shadow-primary/10 scale-[1.03]"
                    : "border-border bg-card"
                )}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground">
                    {t("landing.mostPopular")}
                  </span>
                )}
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground text-sm">/{plan.period}</span>}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{plan.desc}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn("mt-8 w-full", !plan.popular && "bg-secondary text-secondary-foreground hover:bg-secondary/80")}
                  variant={plan.popular ? "default" : "secondary"}
                  onClick={() => navigate("/login")}
                >
                  {plan.cta}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 md:py-28 bg-muted/30">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold md:text-4xl text-foreground">{t("landing.faqTitle")}</h2>
            <p className="mt-4 text-muted-foreground text-lg">{t("landing.faqSubtitle")}</p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border bg-card overflow-hidden">
                <button
                  className="flex w-full items-center justify-between p-5 text-left font-medium text-foreground hover:bg-muted/50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  {openFaq === i ? <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-3xl font-bold md:text-4xl text-foreground">{t("landing.ctaTitle")}</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">{t("landing.ctaSubtitle")}</p>
            <Button size="lg" className="mt-8 text-base px-10" onClick={() => navigate("/login")}>
              {t("landing.ctaButton")} <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t bg-card py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold text-foreground">MedFlow</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">{t("landing.navFeatures")}</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">{t("landing.navPricing")}</a>
              <a href="#faq" className="hover:text-foreground transition-colors">{t("landing.navFaq")}</a>
            </div>
            <p className="text-sm text-muted-foreground">{t("landing.footerCopy")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
