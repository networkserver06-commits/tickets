const KENYAN_PHONE_BODY = /^(?:7|1)\d{8}$/;

/**
 * Converts common Kenyan mobile formats to the canonical 254XXXXXXXXX form.
 * Accepts 07..., 01..., 254..., +254..., and separators such as spaces or hyphens.
 */
export function normalizeKenyanPhone(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("254") && KENYAN_PHONE_BODY.test(digits.slice(3))) {
    return digits;
  }
  if (digits.startsWith("0") && KENYAN_PHONE_BODY.test(digits.slice(1))) {
    return `254${digits.slice(1)}`;
  }
  return "";
}

/** Returns canonical and common legacy representations for database matching. */
export function kenyanPhoneVariants(value: unknown): string[] {
  const canonical = normalizeKenyanPhone(value);
  if (!canonical) return [];
  const local = `0${canonical.slice(3)}`;
  return [canonical, `+${canonical}`, local];
}
