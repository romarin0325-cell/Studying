export function sprite(id, pose = 'idle') {
  const sprites = window.RELAY_ASSETS?.sp;
  return sprites?.[id + '-' + pose] || sprites?.[id + '-idle'] || null;
}

export function background(id) {
  return window.RELAY_ASSETS?.bg?.[id] || '';
}

export function icon(id) {
  return window.RELAY_ASSETS?.icons?.[id] || '';
}
