// Deterministic synthetic PDF: an early partial quote and a later full match.
import { mkdir, writeFile } from 'node:fs/promises';
const pages = [
  ['Introduction', 'A reproducible result appears', 612, 792],
  ['Methods', 'An unrelated page with selectable text.', 612, 792],
  ['Results', 'A reproducible result appears on the final page.', 792, 612],
];
function createPdf(rotation = 0) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R] /Count 3 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  for (const [index, [title, quote, width, height]] of pages.entries()) {
    // The rotated fixtures include a magenta canvas reference behind the quote.
    // Browser tests compare the DOM highlight against these independently drawn pixels.
    const reference = rotation && index === 2 ? `q 1 0 1 rg 58 ${height - 134} 360 20 re f Q\n` : '';
    const stream = `${reference}BT /F1 18 Tf 60 ${height - 70} Td (${title}) Tj 0 -60 Td /F1 13 Tf (${quote}) Tj 0 -60 Td (Synthetic ASTRA UI fixture - page ${index + 1}) Tj ET\n`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Rotate ${rotation} /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`);
  }
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}
const directory = new URL('../public/papers/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('navigation.pdf', directory), createPdf());
for (const rotation of [90, 180, 270]) {
  await writeFile(new URL(`rotation-${rotation}.pdf`, directory), createPdf(rotation));
}
