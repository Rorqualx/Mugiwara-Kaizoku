export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'Unknown';
  return new Date(dateString).toLocaleDateString();
}
