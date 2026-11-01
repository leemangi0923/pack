export const packs = ['square', 'circle'].flatMap(shape =>
  ['소', '중', '대'].map((size, index) => ({
    id: `${shape}-${index}`, shape, size,
    name: `${shape === 'square' ? '사각팩' : '원형팩'} ${size}`,
    width: 2, height: 4 + index,
  })),
);

// SVG coordinates use the same scale on both axes: 20 units per cm.
export function packPreview(pack) {
  const height = pack.height * 20;
  const top = 130 - height;
  const ellipseY = top + 5;
  const body = pack.shape === 'square'
    ? `<rect x="10" y="${top}" width="40" height="${height}" fill="#dbeafe" stroke="#2563eb"/>`
    : `<path d="M10 ${ellipseY} A20 5 0 0 1 50 ${ellipseY} V125 A20 5 0 0 1 10 125 Z" fill="#dbeafe" stroke="#2563eb"/><ellipse cx="30" cy="${ellipseY}" rx="20" ry="5" fill="#eff6ff" stroke="#2563eb"/>`;
  return `<svg class="pack-preview" viewBox="0 0 60 140" aria-hidden="true">${body}</svg>`;
}
