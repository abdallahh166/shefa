# Billing Lifecycle Smoke Test

Use this after applying `20260416150000_invoice_payments_lifecycle.sql` to confirm the day-one billing workflow is usable in the clinic app.

## Preconditions

- Local Supabase stack is running.
- Billing migration has been applied.
- You can sign in as a user with `manage_billing`.
- At least one patient record exists.

## Smoke Flows

### 1. Create invoice with due date

1. Open Billing.
2. Create a new invoice for an existing patient.
3. Enter service, amount, and a future due date.

Expected:

- Invoice appears in the list with `Pending` status.
- `Paid` is `0`.
- `Balance` equals the full invoice amount.
- Due date is shown in the table.

### 2. Post partial payment

1. Open the invoice created above.
2. Click `Post payment`.
3. Enter a payment smaller than the balance and save.

Expected:

- Invoice status becomes `Partially paid`.
- `Paid` increases by the payment amount.
- `Balance` decreases by the same amount.
- Payment history shows the posted transaction.

### 3. Post final payment

1. Re-open `Post payment` on the same invoice.
2. Enter the exact remaining balance and save.

Expected:

- Invoice status becomes `Paid`.
- `Balance` becomes `0`.
- `Paid` equals the full invoice amount.
- Invoice remains visible in the paid filter.

### 4. Void unpaid invoice

1. Create a second unpaid invoice.
2. Click `Void`.
3. Enter a reason and confirm.

Expected:

- Invoice status becomes `Void`.
- `Balance` becomes `0`.
- The invoice no longer behaves like an active receivable.
- Void reason is preserved in the invoice record.

## Negative Checks

- Attempting to overpay should fail.
- Attempting to void an invoice with posted payments should fail.
- Users without billing permissions should not be able to create, post, or void invoices.
