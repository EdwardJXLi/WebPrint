export const titleCase = (value: unknown) =>
  String(value || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};
