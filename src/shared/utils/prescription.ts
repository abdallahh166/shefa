export function formatPrescriptionSig(prescription: {
  dosage?: string | null;
  route?: string | null;
  frequency?: string | null;
}) {
  return [prescription.dosage, prescription.route, prescription.frequency]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" | ");
}

export function formatPrescriptionQuantity(prescription: {
  quantity?: number | null;
  refills?: number | null;
}) {
  const parts: string[] = [];
  if (typeof prescription.quantity === "number") {
    parts.push(`Qty ${prescription.quantity}`);
  }
  if (typeof prescription.refills === "number") {
    parts.push(`${prescription.refills} refill${prescription.refills === 1 ? "" : "s"}`);
  }
  return parts.join(" | ");
}
