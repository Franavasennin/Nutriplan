/**
 * Normaliza un teléfono a formato internacional para wa.me (solo dígitos,
 * sin '+' ni '00', con prefijo de país). wa.me ignora un número mal formado
 * sin avisar, así que quien llame a openWhatsApp debe asumir que el enlace
 * puede abrir el selector de contacto genérico si el teléfono no es válido.
 *
 * Asume España (prefijo 34) cuando el usuario escribe un nacional de 9
 * dígitos sin prefijo — es el caso de uso real de esta clínica (ver
 * placeholder "+34 600 123 456" en AgendaView).
 */
export function normalizePhoneForWhatsApp(raw?: string): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  digits = digits.replace(/^0+/, '');
  if (digits.length === 9) digits = `34${digits}`;
  return digits;
}

/** Abre wa.me con el texto dado, al número normalizado si se aporta uno válido. */
export function openWhatsApp(text: string, phone?: string): void {
  const cleanPhone = normalizePhoneForWhatsApp(phone);
  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
