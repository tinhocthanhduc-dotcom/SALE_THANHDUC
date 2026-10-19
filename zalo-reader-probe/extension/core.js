(() => {
  'use strict';
  const clean = text => String(text || '').replace(/\r\n?/g, '\n').trim();
  const title = text => clean(text).replace(/\s+/g, ' ');
  function readable(text) {
    const lines=clean(text).split('\n'), emojiOnly=/^(?:(?:\/-strong|\/-heart|:>|:o|:-\(\(|:-h)\s*)+$/iu;
    let removed_lines=0;
    const kept=lines.filter(line=>{if(emojiOnly.test(line.trim())){removed_lines++;return false;}return true;});
    return {text:kept.join('\n').trim(),removed_lines};
  }
  const initial = () => ({version: 1, groups: {}, snapshots: [], status: {}, limitations: ['LOADED_DOM_ONLY', 'NO_MESSAGE_IDS', 'NO_HISTORY_COMPLETENESS', 'NO_IMAGE_OCR', 'NO_STOCK_WRITES']});
  function append(state, item) {
    if (!['58','145'].includes(item.group) || !item.text || !item.digest) throw Error('INVALID_SNAPSHOT');
    if (state.snapshots.some(x => x.group === item.group && x.digest === item.digest)) return {state, added: false};
    const next = {...state, snapshots: [...state.snapshots, item]};
    if (next.snapshots.length > 100 || JSON.stringify(next).length > 900000) throw Error('LOCAL_LIMIT');
    return {state: next, added: true};
  }
  globalThis.ZaloProbeCore = {clean, title, readable, initial, append};
})();
