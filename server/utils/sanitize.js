import path from 'node:path';

import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';

const sanitizeText = (value) =>
  Array.from(String(value || ''))
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return character !== '<' && character !== '>' && codePoint >= 32 && codePoint !== 127;
    })
    .join('')
    .trim();

const sanitizeFileName = (value) => {
  const baseName = path.basename(String(value || 'document'));
  return sanitizeText(baseName).replace(/[^a-zA-Z0-9._-]/g, '_') || 'document';
};

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  picture: user.picture,
  role: user.role,
});

const resolvePrinterUri = (input) => {
  const value = sanitizeText(input);
  if (!value) {
    return env.cupsIppUrl;
  }

  if (value.includes('://')) {
    return value;
  }

  if (!env.cupsIppUrl) {
    throw new AppError(400, 'CUPS_IPP_URL is required when saving a queue name instead of a full printer URI.');
  }

  const normalizedBase = env.cupsIppUrl.replace(/\/+$/, '');
  const normalizedValue = value.replace(/^\/+/, '');

  if (normalizedValue.startsWith('printers/')) {
    return `${normalizedBase}/${normalizedValue}`;
  }

  return `${normalizedBase}/printers/${normalizedValue}`;
};

export { resolvePrinterUri, sanitizeFileName, sanitizeText, sanitizeUser };
