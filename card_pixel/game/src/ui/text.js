export function josa(word, pair) {
  const text = String(word);
  const last = text.at(-1);
  const syllable = /[0-9]/.test(last) ? '영일이삼사오육칠팔구'[Number(last)] : last;
  const ending = /[가-힣]/.test(syllable) ? (syllable.charCodeAt(0) - 0xac00) % 28 : 0;
  const [closed, open] = pair.split('/');
  return text + (ending && !(pair === '으로/로' && ending === 8) ? closed : open);
}

// Escaped HTML in, escaped HTML out: a wrapped line never starts with the " · " separator, because the word
// before it and the dot stay together ("황혼 성당 8층 ·" / "결과 확인"). The text content is unchanged.
export function keepSeparators(html) {
  return String(html).replace(/(\S+) · /g, '<span class="nobr">$1 ·</span> ');
}
