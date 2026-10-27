/** Best-effort minimization for external AI, not a detector of every personal datum.
 * No student identifiers or account names are placed in prompts by the caller.
 * Proper names and indirect identifiers still require institutional safeguards.
 */
export function redactPersonalData(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, '[correo omitido]')
    .replace(/\b(?:DNI|documento(?: de identidad)?)\s*[:#-]?\s*\d{8}\b/giu, '[documento omitido]')
    .replace(/(?<!\d)(?:\+51[\s.-]?)?9(?:[\s.-]?\d){8}(?!\d)/gu, '[teléfono omitido]');
}
