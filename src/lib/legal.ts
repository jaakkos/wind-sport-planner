/**
 * Optional public legal / GDPR contact strings (set in env for production).
 */
export function legalContactEmail(): string | null {
  const v = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim();
  return v && v.length > 0 ? v : null;
}

export function dataControllerLabel(): string {
  const v = process.env.NEXT_PUBLIC_DATA_CONTROLLER_NAME?.trim();
  return v && v.length > 0 ? v : "the operator of this Fjell Lift instance";
}
