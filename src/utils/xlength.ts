// X（Twitter）推文长度计算与裁剪，规则参照 twitter-text v3：
// 单条上限 280 权重；拉丁/常用标点算 1，CJK、全角标点、emoji 算 2；链接按 t.co 固定算 23。

export const X_MAX_WEIGHT = 280;
const URL_WEIGHT = 23;
const URL_PATTERN = /https?:\/\/\S+/g;
const SENTENCE_PATTERN = /[^。！？；]+(?:[。！？；]+[」』”’）)]*|$)/g;
const ELLIPSIS = '…';

// twitter-text v3 中权重为 1 的码点区间，其余为 2
const LIGHT_RANGES: [number, number][] = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];

const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });

function graphemeWeight(grapheme: string): number {
  if (/\p{Extended_Pictographic}/u.test(grapheme)) return 2;
  const codePoint = grapheme.codePointAt(0)!;
  return LIGHT_RANGES.some(([lo, hi]) => codePoint >= lo && codePoint <= hi) ? 1 : 2;
}

function plainWeight(text: string): number {
  let weight = 0;
  for (const { segment } of segmenter.segment(text)) {
    weight += graphemeWeight(segment);
  }
  return weight;
}

export function xWeight(text: string): number {
  let weight = 0;
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    weight += plainWeight(text.slice(last, match.index)) + URL_WEIGHT;
    last = match.index + match[0].length;
  }
  return weight + plainWeight(text.slice(last));
}

// 拼出「推荐语 + 空行 + 链接」，超长时从后往前丢整句；第一句都放不下则硬截并以省略号结尾
export function fitXText(summary: string, url: string): string {
  const compose = (body: string) => `${body}\n\n${url}`;

  const full = compose(summary);
  if (xWeight(full) <= X_MAX_WEIGHT) return full;

  const sentences = summary.match(SENTENCE_PATTERN) ?? [];
  for (let count = sentences.length - 1; count > 0; count--) {
    // 「；」和「。」权重相同，替换不影响长度；以「；」收尾读起来像没说完
    const body = sentences.slice(0, count).join('').trimEnd().replace(/；$/, '。');
    const text = compose(body);
    if (xWeight(text) <= X_MAX_WEIGHT) return text;
  }

  let body = '';
  for (const { segment } of segmenter.segment(summary)) {
    if (xWeight(compose(body + segment + ELLIPSIS)) > X_MAX_WEIGHT) break;
    body += segment;
  }
  return compose(body.trimEnd() + ELLIPSIS);
}
