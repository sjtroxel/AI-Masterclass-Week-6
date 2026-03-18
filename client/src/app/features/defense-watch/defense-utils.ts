// Pure display/filter helpers — extracted for unit testability.

export function formatMissDistance(km: number | null): string {
  if (km === null) return '—';
  if (km < 1000) return `${km.toFixed(0)} km`;
  if (km < 1_000_000) return `${(km / 1000).toFixed(1)}k km`;
  return `${(km / 1_000_000).toFixed(2)}M km`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
