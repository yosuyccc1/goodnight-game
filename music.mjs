export function createBackgroundMusic(audio, button, storage, onEnabled = () => {}, onPlaybackBlocked = () => {}) {
  const key = 'ocean-game-music-enabled';
  let enabled = true, active = false, blocked = false, attempt = 0;
  try { enabled = storage?.getItem(key) !== 'false'; } catch {}
  let duckTimer;
  onEnabled(enabled);
  audio.loop = true;
  audio.volume = 0.65;
  function render() {
    button.innerHTML = enabled ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z" stroke-linejoin="round"/><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z" stroke-linejoin="round"/><path d="m16 9 5 6m0-6-5 6"/></svg>';
    const label = blocked && active && enabled ? '播放背景音樂' : enabled ? '關閉聲音' : '開啟聲音';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(enabled));
    button.title = label;
    onPlaybackBlocked(blocked && active && enabled);
  }
  function sync() {
    const id = ++attempt;
    audio.muted = !enabled;
    if (!active || !enabled) { audio.pause(); blocked = false; render(); return; }
    // Call play synchronously in the user's click, including on mobile Safari.
    try {
      Promise.resolve(audio.play()).then(() => {
        if (id === attempt) { blocked = false; render(); }
      }).catch(() => {
        if (id === attempt) { blocked = true; render(); }
      });
    } catch { blocked = true; }
    render();
  }
  button.addEventListener('click', () => {
    if (!(blocked && active && enabled)) enabled = !enabled;
    onEnabled(enabled);
    try { storage?.setItem(key, String(enabled)); } catch {}
    sync();
  });
  render();
  return {
    start(restart = false) {
      if (restart) { try { audio.currentTime = 0; } catch {} }
      active = true;
      sync();
    },
    retry() { if (active && enabled && (blocked || audio.paused)) sync(); },
    duck() {
      clearTimeout(duckTimer);audio.volume=.32;
      duckTimer=setTimeout(()=>{audio.volume=.65;},400);
    },
    pause() { active = false; sync(); }
  };
}
