/** ₹ formatting: lakhs under 1 Cr, crores above ("225L" → "₹2.25 Cr"). */
export function money(lakhs: number): string {
  if (lakhs >= 100) {
    const cr = lakhs / 100;
    return `₹${Number.isInteger(cr) ? cr : cr.toFixed(2)} Cr`;
  }
  return `₹${lakhs}L`;
}
