import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SessionTimeout } from "./features/auth/SessionTimeout";
import { ReauthDialog } from "./features/auth/ReauthDialog";
import { ProtectedRoute } from "./core/auth/ProtectedRoute";
import { PortalProtectedRoute } from "./core/auth/PortalProtectedRoute";
import { SubscriptionProvider } from "./core/subscription/SubscriptionContext";
import { ErrorBoundary } from "./shared/components/ErrorBoundary";

const LandingPage = lazy(() => import("./pages/LandingPage").then((m) => ({ default: m.LandingPage })));
const AdminDashboardPage = lazy(() => import("./features/admin/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const TutorialPage = lazy(() => import("./pages/TutorialPage").then((m) => ({ default: m.TutorialPage })));
const PricingPage = lazy(() => import("./pages/PricingPage").then((m) => ({ default: m.PricingPage })));
const ClinicLayout = lazy(() => import("./layouts/ClinicLayout").then((m) => ({ default: m.ClinicLayout })));
const PortalLayout = lazy(() => import("./features/portal/PortalLayout").then((m) => ({ default: m.PortalLayout })));
const PortalLoginPage = lazy(() => import("./pages/PortalLoginPage").then((m) => ({ default: m.PortalLoginPage })));
const PortalDashboardPage = lazy(() => import("./features/portal/PortalDashboardPage").then((m) => ({ default: m.PortalDashboardPage })));
const PortalAppointmentsPage = lazy(() => import("./features/portal/PortalPages").then((m) => ({ default: m.PortalAppointmentsPage })));
const PortalPrescriptionsPage = lazy(() => import("./features/portal/PortalPages").then((m) => ({ default: m.PortalPrescriptionsPage })));
const PortalLabResultsPage = lazy(() => import("./features/portal/PortalPages").then((m) => ({ default: m.PortalLabResultsPage })));
const PortalDocumentsPage = lazy(() => import("./features/portal/PortalPages").then((m) => ({ default: m.PortalDocumentsPage })));
const PortalInvoicesPage = lazy(() => import("./features/portal/PortalPages").then((m) => ({ default: m.PortalInvoicesPage })));
const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const PatientsPage = lazy(() => import("./features/patients/PatientsPage").then((m) => ({ default: m.PatientsPage })));
const PatientDetailPage = lazy(() => import("./features/patients/PatientDetailPage").then((m) => ({ default: m.PatientDetailPage })));
const AppointmentsPage = lazy(() => import("./features/appointments/AppointmentsPage").then((m) => ({ default: m.AppointmentsPage })));
const DoctorsPage = lazy(() => import("./features/doctors/DoctorsPage").then((m) => ({ default: m.DoctorsPage })));
const BillingPage = lazy(() => import("./features/billing/BillingPage").then((m) => ({ default: m.BillingPage })));
const PharmacyPage = lazy(() => import("./features/pharmacy/PharmacyPage").then((m) => ({ default: m.PharmacyPage })));
const LaboratoryPage = lazy(() => import("./features/laboratory/LaboratoryPage").then((m) => ({ default: m.LaboratoryPage })));
const InsurancePage = lazy(() => import("./features/insurance/InsurancePage").then((m) => ({ default: m.InsurancePage })));
const ReportsPage = lazy(() => import("./features/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import("./features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const TelemedicineCallPage = lazy(() => import("./features/telemedicine/TelemedicineCallPage").then((m) => ({ default: m.TelemedicineCallPage })));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <SessionTimeout />
      <ReauthDialog />
      <SubscriptionProvider>
        <ErrorBoundary>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading...</div>}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/tutorial" element={<TutorialPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/" element={<LandingPage />} />
                <Route path="/portal/:clinicSlug/login" element={<PortalLoginPage />} />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requiredPermission="super_admin">
                      <AdminDashboardPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/tenant/:clinicSlug"
                  element={
                    <ProtectedRoute>
                      <ClinicLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="patients" element={<PatientsPage />} />
                  <Route path="patients/:patientId" element={<PatientDetailPage />} />
                  <Route path="appointments" element={<AppointmentsPage />} />
                  <Route path="appointments/:appointmentId/video" element={<TelemedicineCallPage />} />
                  <Route path="doctors" element={<DoctorsPage />} />
                  <Route path="billing" element={<BillingPage />} />
                  <Route path="pharmacy" element={<PharmacyPage />} />
                  <Route path="laboratory" element={<LaboratoryPage />} />
                  <Route path="insurance" element={<InsurancePage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                <Route
                  path="/portal/:clinicSlug"
                  element={
                    <PortalProtectedRoute>
                      <PortalLayout />
                    </PortalProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<PortalDashboardPage />} />
                  <Route path="appointments" element={<PortalAppointmentsPage />} />
                  <Route path="prescriptions" element={<PortalPrescriptionsPage />} />
                  <Route path="lab-results" element={<PortalLabResultsPage />} />
                  <Route path="documents" element={<PortalDocumentsPage />} />
                  <Route path="invoices" element={<PortalInvoicesPage />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </SubscriptionProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
