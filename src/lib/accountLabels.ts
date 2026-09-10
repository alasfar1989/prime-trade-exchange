// Amazon's account-level type names arrive in two shapes: SCREAMING_SNAKE
// (WAREHOUSE_LOST) and PascalCase that may embed an acronym
// (FBAInboundTransportationFee, CustomerReturnHRRUnitFee). Render both as
// prose, keeping genuine acronyms uppercase — "Fbainbound transportation fee"
// reads like a bug.
export function accountTypeLabel(type: string): string {
  const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // Fully screaming-snake: every word is caps for emphasis, not an acronym.
  if (/^[A-Z0-9_]+$/.test(type)) {
    return sentence(type.toLowerCase().replace(/_/g, ' '));
  }

  // PascalCase (possibly with underscores): split on case boundaries, including
  // the acronym-to-word seam (FBAInbound -> FBA Inbound).
  const words = type
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean);

  return words
    .map((w, i) => (/^[A-Z]{2,}$/.test(w) ? w : i === 0 ? sentence(w.toLowerCase()) : w.toLowerCase()))
    .join(' ');
}
