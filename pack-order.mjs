export function nextPackKey(keys, currentKey) {
  const ordered = [...keys].sort((a, b) => {
    const [ax, ay, al = 0] = a.split(',').map(Number);
    const [bx, by, bl = 0] = b.split(',').map(Number);
    return al - bl || ay - by || ax - bx;
  });
  const index = ordered.indexOf(currentKey);
  return index < 0 ? null : ordered[index + 1] ?? null;
}
