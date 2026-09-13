/**
 * Parametry uruchomienia z URL (`?seed=123`). DOM jest tu dozwolony — to warstwa renderu,
 * nie `src/sim` (kontrakt: `docs/architecture.md`).
 */

/** Seed używany, gdy w URL nic nie ma (albo jest śmieć). */
export const DEFAULT_SEED = 42;

/** `?seed=` z URL-a jako 32-bitowy int; `DEFAULT_SEED` gdy brak lub niepoprawny. */
export function readSeed(search?: string): number {
  const query = search ?? (typeof location === 'undefined' ? '' : location.search);
  const raw = new URLSearchParams(query).get('seed');
  if (raw === null) return DEFAULT_SEED;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value | 0 : DEFAULT_SEED;
}
