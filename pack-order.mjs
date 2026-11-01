export function nextPackKey(keys, currentKey) {
  const ordered = [...keys].sort((a, b) => {
    const [ax, ay] = a.split(',').map(Number);
    const [bx, by] = b.split(',').map(Number);
    return ay - by || ax - bx;
  });
  const index = ordered.indexOf(currentKey);
  return index < 0 ? null : ordered[index + 1] ?? null;
}
