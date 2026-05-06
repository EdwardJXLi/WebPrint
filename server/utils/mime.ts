const knownFileTypes = [
  {
    mimeType: 'application/pdf',
    extension: '.pdf',
    test: (buffer) => buffer.subarray(0, 4).toString() === '%PDF',
  },
  {
    mimeType: 'image/png',
    extension: '.png',
    test: (buffer) =>
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47,
  },
  {
    mimeType: 'image/jpeg',
    extension: '.jpg',
    test: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    mimeType: 'image/gif',
    extension: '.gif',
    test: (buffer) => buffer.subarray(0, 6).toString() === 'GIF87a' || buffer.subarray(0, 6).toString() === 'GIF89a',
  },
  {
    mimeType: 'image/webp',
    extension: '.webp',
    test: (buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP',
  },
  {
    mimeType: 'image/bmp',
    extension: '.bmp',
    test: (buffer) => buffer.subarray(0, 2).toString() === 'BM',
  },
  {
    mimeType: 'image/tiff',
    extension: '.tiff',
    test: (buffer) =>
      (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
      (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a),
  },
];

const detectAllowedFileType = (buffer) => knownFileTypes.find((fileType) => fileType.test(buffer)) || null;

const extensionForMimeType = (mimeType) =>
  knownFileTypes.find((fileType) => fileType.mimeType === mimeType)?.extension || '';

export { detectAllowedFileType, extensionForMimeType, knownFileTypes };
