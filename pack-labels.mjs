export const symbolLabels = ['○', '△', '□', '◇'];
export function parsePackLabel(value) {
  const text = String(value).trim();
  if (symbolLabels.includes(text)) return text;
  if (/^\d{1,6}$/.test(text)) return Number(text);
  throw new Error('0–999999의 정수 또는 ○ △ □ ◇ 중 하나를 선택해 주세요.');
}
