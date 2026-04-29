export const titleCase = (value) =>
  String(value || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

export const formatDateTime = (value) => {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};
