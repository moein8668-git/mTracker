export function newerWins<T extends { updatedAt?: string; deletedAt?: string | null }>(local: T, remote: T): T {
  const localUpd = local.updatedAt ?? '';
  const remoteUpd = remote.updatedAt ?? '';
  return remoteUpd > localUpd ? remote : local;
}

export function isoOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
