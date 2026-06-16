export function calculateReadingProgress(
  currentPage: number,
  totalPages: number,
): number {
  if (totalPages <= 0) return 0;
  const percent = ((currentPage + 1) / totalPages) * 100;
  return Math.round(percent * 100) / 100;
}

export function pageFromProgress(progress: number, totalPages: number): number {
  if (totalPages <= 0) return 0;
  if (progress <= 0) return 0;
  const page = Math.ceil((progress / 100) * totalPages) - 1;
  return Math.max(0, Math.min(page, totalPages - 1));
}

export function formatProgressDisplay(progress: number): string {
  return progress.toFixed(2);
}
