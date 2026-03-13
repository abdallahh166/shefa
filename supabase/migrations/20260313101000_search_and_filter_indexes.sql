-- Search performance: trigram indexes for ILIKE searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Patients search
CREATE INDEX IF NOT EXISTS idx_patients_full_name_trgm
  ON public.patients USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_patient_code_trgm
  ON public.patients USING gin (patient_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_email_trgm
  ON public.patients USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_phone_trgm
  ON public.patients USING gin (phone gin_trgm_ops);

-- Doctors search
CREATE INDEX IF NOT EXISTS idx_doctors_full_name_trgm
  ON public.doctors USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_doctors_specialty_trgm
  ON public.doctors USING gin (specialty gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_doctors_phone_trgm
  ON public.doctors USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_doctors_email_trgm
  ON public.doctors USING gin (email gin_trgm_ops);

-- Appointments search
CREATE INDEX IF NOT EXISTS idx_appointments_notes_trgm
  ON public.appointments USING gin (notes gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_appointments_type_trgm
  ON public.appointments USING gin (type gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_appointments_status_trgm
  ON public.appointments USING gin (status gin_trgm_ops);

-- Invoices search
CREATE INDEX IF NOT EXISTS idx_invoices_code_trgm
  ON public.invoices USING gin (invoice_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_invoices_service_trgm
  ON public.invoices USING gin (service gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_invoices_status_trgm
  ON public.invoices USING gin (status gin_trgm_ops);

-- Insurance claims search
CREATE INDEX IF NOT EXISTS idx_insurance_provider_trgm
  ON public.insurance_claims USING gin (provider gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_insurance_service_trgm
  ON public.insurance_claims USING gin (service gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_insurance_status_trgm
  ON public.insurance_claims USING gin (status gin_trgm_ops);

-- Lab orders search
CREATE INDEX IF NOT EXISTS idx_lab_orders_test_name_trgm
  ON public.lab_orders USING gin (test_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status_trgm
  ON public.lab_orders USING gin (status gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lab_orders_result_trgm
  ON public.lab_orders USING gin (result gin_trgm_ops);

-- Prescriptions search
CREATE INDEX IF NOT EXISTS idx_prescriptions_medication_trgm
  ON public.prescriptions USING gin (medication gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_prescriptions_dosage_trgm
  ON public.prescriptions USING gin (dosage gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status_trgm
  ON public.prescriptions USING gin (status gin_trgm_ops);

-- Medications search
CREATE INDEX IF NOT EXISTS idx_medications_name_trgm
  ON public.medications USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_medications_category_trgm
  ON public.medications USING gin (category gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_medications_status_trgm
  ON public.medications USING gin (status gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_medications_unit_trgm
  ON public.medications USING gin (unit gin_trgm_ops);

-- Common filter indexes for list screens
CREATE INDEX IF NOT EXISTS idx_patients_tenant_status
  ON public.patients (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_doctors_tenant_status
  ON public.doctors (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_doctors_tenant_specialty
  ON public.doctors (tenant_id, specialty);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_doctor_date
  ON public.appointments (tenant_id, doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_patient_date
  ON public.appointments (tenant_id, patient_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_patient_date
  ON public.invoices (tenant_id, patient_id, invoice_date);

CREATE INDEX IF NOT EXISTS idx_insurance_tenant_status_date
  ON public.insurance_claims (tenant_id, status, claim_date);
CREATE INDEX IF NOT EXISTS idx_insurance_tenant_patient_date
  ON public.insurance_claims (tenant_id, patient_id, claim_date);

CREATE INDEX IF NOT EXISTS idx_lab_orders_tenant_status_date
  ON public.lab_orders (tenant_id, status, order_date);
CREATE INDEX IF NOT EXISTS idx_lab_orders_tenant_patient_date
  ON public.lab_orders (tenant_id, patient_id, order_date);
CREATE INDEX IF NOT EXISTS idx_lab_orders_tenant_doctor_date
  ON public.lab_orders (tenant_id, doctor_id, order_date);

CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant_status_date
  ON public.prescriptions (tenant_id, status, prescribed_date);
CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant_patient_date
  ON public.prescriptions (tenant_id, patient_id, prescribed_date);
CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant_doctor_date
  ON public.prescriptions (tenant_id, doctor_id, prescribed_date);

CREATE INDEX IF NOT EXISTS idx_medications_tenant_status
  ON public.medications (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_medications_tenant_category
  ON public.medications (tenant_id, category);
