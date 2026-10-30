/** Audio style is local to this browser and separate from game progress backups. */
export type AudioStyle = 'dos' | 'windows';
const AUDIO_STYLE_KEY = 'lemmings.audio-style.v1';

export function readAudioStyle(): AudioStyle {
  try { return localStorage.getItem(AUDIO_STYLE_KEY) === 'windows' ? 'windows' : 'dos'; }
  catch { return 'dos'; }
}

export function writeAudioStyle(style: AudioStyle): boolean {
  if (style !== 'dos' && style !== 'windows') return false;
  try { localStorage.setItem(AUDIO_STYLE_KEY, style); return true; }
  catch { return false; }
}
