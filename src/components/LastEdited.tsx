function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LastEdited({ updatedBy, updatedAt }: { updatedBy?: string; updatedAt?: string }) {
  if (!updatedBy) return null;
  return (
    <p className="text-xs text-gray-400">
      Last edited by {updatedBy}{updatedAt ? ` · ${relativeTime(updatedAt)}` : ''}
    </p>
  );
}
