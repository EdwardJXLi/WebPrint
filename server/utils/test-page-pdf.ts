const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

const escapePdfText = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const text = (x, y, size, value, { bold = false, color = [0.15, 0.19, 0.25] } = {}) =>
  `${color[0]} ${color[1]} ${color[2]} rg BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET\n`;

const line = (x1, y1, x2, y2, width = 1) =>
  `0.15 0.19 0.25 RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S\n`;

const rect = (x, y, width, height, [r, g, b], stroke = false) =>
  `${r} ${g} ${b} rg ${x} ${y} ${width} ${height} re f\n${
    stroke ? `0.15 0.19 0.25 RG 0.8 w ${x} ${y} ${width} ${height} re S\n` : ''
  }`;

const truncate = (value, limit = 76) => {
  const textValue = String(value || '');
  return textValue.length > limit ? `${textValue.slice(0, limit - 3)}...` : textValue;
};

const buildPdf = (content) => {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    [
      '<< /Type /Page /Parent 2 0 R',
      `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`,
      '/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >>',
      '/Contents 6 0 R',
      '>>',
    ].join(' '),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}endstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
};

const keyValueRows = (rows, startY) => {
  let content = '';
  let y = startY;

  rows.forEach(([label, value]) => {
    content += text(58, y, 10, label, { bold: true });
    content += text(170, y, 10, truncate(value || 'Not available'));
    y -= 18;
  });

  return content;
};

const createTestPagePdf = ({ appName, appVersion, appBaseUrl, printer, user, generatedAt = new Date() }) => {
  const timestamp = generatedAt.toISOString();
  const displayAppName = appName || 'WebPrint';
  const displayVersion = appVersion ? `v${appVersion}` : 'Not available';
  const submittedBy = user?.email || user?.name || 'WebPrint user';

  let content = '';

  content += rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, [1, 1, 1]);
  content += rect(0, PAGE_HEIGHT - 72, PAGE_WIDTH, 72, [0.92, 0.98, 0.94]);
  content += rect(0, PAGE_HEIGHT - 78, PAGE_WIDTH, 6, [0.09, 0.48, 0.26]);
  content += text(54, 738, 24, `${displayAppName} Test Page`, { bold: true });

  content += text(54, 675, 13, 'Printer', { bold: true });
  content += line(54, 664, 558, 664);
  content += keyValueRows(
    [
      ['Name', printer?.name],
      ['Description', printer?.description],
      ['IPP URI', printer?.ipp_uri],
      ['Submitted by', submittedBy],
      ['Generated', timestamp],
    ],
    644,
  );

  content += text(54, 520, 13, 'WebPrint', { bold: true });
  content += line(54, 509, 558, 509);
  content += keyValueRows(
    [
      ['Application name', displayAppName],
      ['Application version', displayVersion],
      ['Application URL', appBaseUrl],
      ['Purpose', 'Printer setup and output verification'],
    ],
    489,
  );

  content += text(54, 392, 13, 'Color Test', { bold: true });
  content += line(54, 381, 558, 381);

  const colors: [string, [number, number, number], [number, number, number]][] = [
    ['Black', [0, 0, 0], [1, 1, 1]],
    ['Cyan', [0, 0.68, 0.9], [0, 0, 0]],
    ['Magenta', [0.92, 0, 0.52], [1, 1, 1]],
    ['Yellow', [1, 0.86, 0], [0, 0, 0]],
    ['Red', [0.86, 0.12, 0.12], [1, 1, 1]],
    ['Green', [0.1, 0.58, 0.29], [1, 1, 1]],
    ['Blue', [0.1, 0.32, 0.82], [1, 1, 1]],
  ];

  colors.forEach(([label, fill, labelColor], index) => {
    const x = 54 + index * 72;
    content += rect(x, 328, 62, 38, fill, true);
    content += text(x + 8, 343, 9, label, { bold: true, color: labelColor });
  });

  content += text(54, 282, 13, 'Grayscale Test', { bold: true });
  content += line(54, 271, 558, 271);

  const grayscaleSteps = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1];
  grayscaleSteps.forEach((shade, index) => {
    const x = 54 + index * 63;
    content += rect(x, 220, 54, 36, [shade, shade, shade], true);
    content += text(x + 8, 202, 8, `${Math.round(shade * 100)}%`);
  });

  content += text(54, 154, 13, 'Registration Lines', { bold: true });
  content += line(54, 143, 558, 143);
  content += line(54, 104, 558, 104, 0.5);
  content += line(54, 90, 558, 90, 0.5);
  content += line(54, 76, 558, 76, 0.5);
  content += line(54, 62, 558, 62, 0.5);

  content += text(54, 35, 8, `Generated by WebPrint ${displayVersion} for printer verification.`);

  return buildPdf(content);
};

export { createTestPagePdf };
