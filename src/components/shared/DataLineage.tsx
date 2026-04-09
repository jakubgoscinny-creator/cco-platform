import { RefreshCw } from "lucide-react";

export function DataLineage({ syncedAt }: { syncedAt: Date | null }) {
  if (!syncedAt) return null;

  const ago = getTimeAgo(syncedAt);

  return (
    <div className="flex items-center gap-1.5 text-xs text-cco-muted">
      <RefreshCw size={12} />
      <span>Synced {ago}</span>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
