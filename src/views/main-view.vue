<template>
  <main class="home" :class="{ 'is-ready': ready }">
    <div class="home-inner">
      <header class="topbar"><span class="brand">LEMMINGS <span>TS</span></span></header>
      <section class="hero" aria-labelledby="welcome-title">
        <div class="hero-copy">
          <h1 id="welcome-title">Let's get them home.</h1>
          <p class="intro">{{ ready ? 'Choose a difficulty and level, then lead your lemmings to the exit.' : 'Add your original Windows or DOS Lemmings files to play.' }}</p>
          <p class="preview-note">Early preview. Testing on different devices is still underway.</p>
          <div v-if="ready" class="actions">
            <label class="game-mode">Game mode
              <select :value="gameMode" :disabled="busy || voiceBusy" @change="onGameModeChange">
                <option value="dos" :disabled="!dosReady">DOS{{ dosReady ? '' : ' (add DOS files)' }}</option>
                <option value="windows" :disabled="!windowsReady">Windows{{ windowsReady ? '' : windowsSetup === 'checking' ? ' (setting up…) ' : ' (add complete Windows files)' }}</option>
              </select>
            </label>
            <p v-if="modeMessage" class="status-message" role="status">{{ modeMessage }}</p>
            <p v-if="gameMode === 'windows' && !windowsReady" class="hint" role="status">Windows files are not ready on this device. Add them below or choose DOS to play.</p>
            <div class="level-picker" v-if="groups.length">
              <label>Difficulty <select v-model.number="selectedGroup" @change="selectedLevel = 0"><option v-for="(group, index) in groups" :key="group.name" :value="index">{{ group.name }}</option></select></label>
              <label>Level <select v-model.number="selectedLevel"><option v-for="index in groups[selectedGroup].count" :key="index" :value="index - 1">{{ index }}{{ bestScore(selectedGroup, index - 1) === null ? '' : ` (best ${bestScore(selectedGroup, index - 1)}%)` }}</option></select></label>
            </div>
            <p v-if="bestScore(selectedGroup, selectedLevel) !== null" class="best-score">Best saved: {{ bestScore(selectedGroup, selectedLevel) }}%</p>
            <router-link v-if="(gameMode === 'dos' && dosReady) || (gameMode === 'windows' && windowsReady)" class="primary-button" :to="{ name: 'game', params: { gameType: 1 }, query: { group: selectedGroup, level: selectedLevel } }">Play Lemmings</router-link>
            <button v-else class="primary-button" type="button" disabled>Play Lemmings</button>
            <p class="ready-note">Your game files are ready on this device</p>
          </div>
          <div v-else class="actions">
            <button class="primary-button" type="button" :disabled="busy || voiceBusy" @click="voiceInput?.click()">{{ voiceBusy ? 'Getting things ready…' : 'Add Windows ISO' }}</button>
            <button class="text-button folder-button" type="button" :disabled="busy || voiceBusy" @click="voiceFolderInput?.click()">Or choose a Windows folder</button>
            <a class="edition-link" href="#dos-title">Have the DOS edition?</a>
            <p v-if="voiceMessage" class="status-message" role="status">{{ voiceMessage }}</p>
          </div>
          <p class="offline-note" role="status">{{ offlineReadiness === 'checking' ? 'Preparing offline play…' : offlineReadiness === 'ready' ? (ready ? 'The app shell is ready offline; your game files are stored on this device.' : 'The app shell is ready offline. Add your game files to play.') : 'Offline play may be unavailable. Reconnect and reopen the app.' }}</p>
          <p v-if="checkingAutomaticFiles && !ready" class="offline-note" role="status">Checking for game files supplied by this installation. You can also add your own files now.</p>
          <p v-if="windowsSetup === 'checking' && !windowsReady" class="offline-note" role="status">Checking for Windows files on this installation…</p>
          <div v-if="windowsSetup === 'failed' && !windowsReady" class="offline-note" role="status">
            Windows files could not be set up automatically. Check your connection and try again, or add your own files below.
            <button class="text-button" type="button" @click="checkAutomaticVoices">Retry Windows setup</button>
          </div>
          <input ref="fileInput" class="visually-hidden" type="file" multiple tabindex="-1" aria-hidden="true" @change="onFilesSelected" />
          <input ref="folderInput" class="visually-hidden" type="file" webkitdirectory multiple tabindex="-1" aria-hidden="true" @change="onFilesSelected" />
          <p v-if="message" class="status-message" role="status">{{ message }}</p>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="art-frame">
            <div class="art-topline"><span>LEMMINGS TS</span><span>{{ gameMode === 'windows' && windowsReady ? 'Windows levels' : '120 levels' }}</span></div>
            <div class="art-screen">
              <div class="fallback-landscape" :class="{ 'is-hidden': artworkReady }">
                <span class="pixel-sun"></span><span class="pixel-mountain mountain-back"></span><span class="pixel-mountain mountain-front"></span>
                <span class="pixel-platform"></span><span class="pixel-steps"></span>
                <span class="fallback-caption">A little adventure awaits</span>
              </div>
              <canvas ref="backgroundCanvas" v-show="artworkReady" class="original-background" data-home-background></canvas>
              <canvas ref="logoCanvas" v-show="artworkReady" class="original-logo" data-home-logo></canvas>
            </div>
            <div class="art-bottomline"><span>Your adventure</span><span>Press play</span></div>
          </div>
        </div>
      </section>
      <section class="setup" aria-labelledby="voices-title">
        <div><h2 id="voices-title">Windows game files</h2></div>
        <div class="setup-detail">
          <p>Files you add stay in this browser. They aren’t uploaded or synced between devices.</p>
          <p v-if="windowsReady">Your Windows levels, graphics and audio are ready. To replace them, choose the ISO, complete game folder or ZIP.</p>
          <p v-else>Choose a Windows Lemmings <strong>ISO</strong>, or an extracted game folder or ZIP containing its levels, graphics and audio. Windows mode needs no DOS files.</p>
          <div class="backup-actions">
            <button class="text-button" type="button" :disabled="busy || voiceBusy" @click="voiceInput?.click()">{{ voicesReady ? 'Replace Windows files' : 'Add Windows files' }}</button>
            <button class="text-button" type="button" :disabled="busy || voiceBusy" @click="voiceFolderInput?.click()">Choose game folder</button>
            <button v-if="voicesReady || graphicsReady || windowsGameReady" class="text-button" type="button" :disabled="busy || voiceBusy" @click="removeVoices">Remove Windows files</button>
          </div>
          <p v-if="voiceMessage && ready" class="status-message" role="status">{{ voiceMessage }}</p>
          <input ref="voiceInput" class="visually-hidden" type="file" accept=".wav,.mid,.midi,.zip,.iso,audio/wav,audio/midi,application/zip,application/x-iso9660-image" multiple tabindex="-1" aria-hidden="true" @change="onVoicesSelected" />
          <input ref="voiceFolderInput" class="visually-hidden" type="file" webkitdirectory multiple tabindex="-1" aria-hidden="true" @change="onVoicesSelected" />
        </div>
      </section>
      <section class="setup" aria-labelledby="dos-title">
        <div><h2 id="dos-title">DOS game files</h2></div>
        <div class="setup-detail">
          <p>Choose the original <strong>.dat</strong> files together, their folder, or a ZIP containing them.</p>
          <div class="backup-actions">
            <button class="text-button" type="button" :disabled="busy || voiceBusy" @click="fileInput?.click()">{{ dosReady ? 'Replace DOS files' : 'Add DOS files' }}</button>
            <button class="text-button folder-button" type="button" :disabled="busy || voiceBusy" @click="folderInput?.click()">Or choose a DOS folder</button>
            <button v-if="dosReady" class="text-button" type="button" :disabled="busy || voiceBusy" @click="removeFiles">Remove DOS files</button>
          </div>
        </div>
      </section>
      <section class="setup backup" aria-labelledby="backup-title">
        <div><h2 id="backup-title">Progress backup</h2></div>
        <div class="setup-detail">
          <p>Back up progress, settings and your last level. Your original game files are not included. Restoring replaces the progress and settings on this device.</p>
          <div class="backup-actions">
            <button class="text-button" type="button" :disabled="busy" @click="downloadBackup">Export backup</button>
            <button class="text-button" type="button" :disabled="busy" @click="backupInput?.click()">Restore backup</button>
          </div>
          <p v-if="backupMessage" class="status-message" role="status">{{ backupMessage }}</p>
          <input ref="backupInput" class="visually-hidden" type="file" accept=".json,application/json" tabindex="-1" aria-hidden="true" @change="onBackupSelected" />
        </div>
      </section>
      <footer><span>Made for Vanessa ❤️</span><a :href="`${baseUrl}third-party.html`">Source and licences</a></footer>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { clearLemmingsFiles, hasLemmingsFiles, importLemmingsFiles, hasWindowsVoiceFiles, hasWindowsAudioFiles } from '@/game/resources/file/game-file-store';
import { importBundledLemmingsFiles } from '@/game/resources/file/bundled-game-import';
import { importBundledWindowsVoices } from '@/game/resources/file/bundled-voice-import';
import { importBundledWindowsGraphics } from '@/game/resources/file/bundled-graphics-import';
import { importBundledWindowsGame } from '@/game/resources/file/bundled-windows-game-import';
import { hasWindowsGraphics, hasStandaloneWindowsGraphics } from '@/game/resources/file/windows-graphics-store';
import { hasWindowsGame } from '@/game/resources/file/windows-game-store';
import { allowBundledWindowsOnReload, clearWindowsFiles, importWindowsFiles } from '@/game/resources/file/windows-file-import';
import { GameFactory } from '@/game/game-factory';
import { GameTypes } from '@/game/game-types';
import { readGameMode, readGameModePreference, writeGameMode, type GameMode } from '@/game/game-mode';
import { exportProgressBackup, readLastLevel, readProgress, restoreProgressBackup, suggestNextLevel } from '@/game/progress';
import { loadHomeArtwork, paintHomeArtwork } from '@/game/resources/home-artwork';
import { offlineReadiness } from '@/offline-readiness';

const baseUrl = import.meta.env.BASE_URL;

const dosReady = ref(false);
const busy = ref(false);
const checkingAutomaticFiles = ref(true);
const windowsSetup = ref<'checking' | 'done' | 'failed'>('checking');
const message = ref('');
const backupMessage = ref('');
const voiceMessage = ref('');
const modeMessage = ref('');
const voicesReady = ref(false);
const audioReady = ref(false);
const graphicsReady = ref(false);
const windowsGameReady = ref(false);
const standaloneGraphicsReady = ref(false);
const windowsReady = computed(() => windowsGameReady.value && audioReady.value && standaloneGraphicsReady.value);
const ready = computed(() => dosReady.value || windowsReady.value);
const voiceBusy = ref(false);
const gameMode = ref<GameMode>(readGameMode());
const gameModePreference = ref<GameMode | null>(readGameModePreference());
const fileInput = ref<HTMLInputElement | null>(null);
const voiceInput = ref<HTMLInputElement | null>(null);
const voiceFolderInput = ref<HTMLInputElement | null>(null);
const folderInput = ref<HTMLInputElement | null>(null);
const backupInput = ref<HTMLInputElement | null>(null);
const logoCanvas = ref<HTMLCanvasElement | null>(null);
const backgroundCanvas = ref<HTMLCanvasElement | null>(null);
const artworkReady = ref(false);
let artworkRequest = 0;
let disposed = false;
let manualGeneration = 0;
let readinessGeneration = 0;
let voiceReadinessGeneration = 0;
let voiceManualGeneration = 0;
let initialWindowsSetup: Promise<void> | undefined;
let windowsCheck: Promise<void> | undefined;

watch(dosReady, async (hasFiles) => {
  const request = ++artworkRequest;
  artworkReady.value = false;
  if (!hasFiles) {
    // Discard decoded pixels when the player removes the local files.
    for (const canvas of [logoCanvas.value, backgroundCanvas.value]) {
      if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
    return;
  }
  try {
    const artwork = await loadHomeArtwork();
    if (request !== artworkRequest || !artwork || !logoCanvas.value || !backgroundCanvas.value) return;
    artworkReady.value = paintHomeArtwork(logoCanvas.value, artwork.logo)
      && paintHomeArtwork(backgroundCanvas.value, artwork.background);
  } catch {
    // Artwork is optional: keep the accessible home screen usable if an import
    // is incomplete, incompatible, or local storage becomes unavailable.
  }
});
onBeforeUnmount(() => { artworkRequest++; disposed = true; readinessGeneration++; voiceReadinessGeneration++; });
const groups = ref<{ name: string; count: number }[]>([]);
const selectedGroup = ref(0);
const selectedLevel = ref(0);
const progress = ref(readProgress(gameMode.value));
function bestScore(group: number, level: number): number | null {
  return progress.value.find(entry => entry.gameType === GameTypes.LEMMINGS && entry.groupIndex === group && entry.levelIndex === level)?.bestSavedPercent ?? null;
}
function selectLastLevel() {
  const last = suggestNextLevel(readLastLevel(gameMode.value), progress.value, groups.value.map(group => group.count));
  if (last?.gameType === GameTypes.LEMMINGS && groups.value[last.groupIndex] && last.levelIndex < groups.value[last.groupIndex].count) {
    selectedGroup.value = last.groupIndex;
    selectedLevel.value = last.levelIndex;
  } else {
    selectedGroup.value = 0;
    selectedLevel.value = 0;
  }
}
async function refreshReadiness() {
  const generation = ++readinessGeneration;
  try {
    const hasFiles = await hasLemmingsFiles();
    if (!disposed && generation === readinessGeneration && !busy.value) dosReady.value = hasFiles;
    return hasFiles;
  } catch {
    if (!disposed && generation === readinessGeneration && !busy.value) message.value = 'This browser could not access local storage. Check your browser settings and try again.';
    return false;
  }
}

async function checkAutomaticFiles() {
  const manualAtStart = manualGeneration;
  let automaticSetupError = '';
  let automaticallyImported = false;
  try {
    const result = await importBundledLemmingsFiles();
    automaticallyImported = result === 'imported';
  } catch (error) {
    automaticSetupError = error instanceof Error ? error.message : 'Automatic setup could not be completed. Please add your game files manually.';
  }
  if (disposed) return;
  checkingAutomaticFiles.value = false;
  if (busy.value) return;
  const hasFiles = await refreshReadiness();
  if (disposed || manualAtStart !== manualGeneration || busy.value) return;
  if (hasFiles && automaticallyImported) message.value = 'Game files added to this device. You’re ready to play!';
  else if (!hasFiles && automaticSetupError) message.value = automaticSetupError;
}

onMounted(async () => {
  void refreshReadiness();
  void refreshVoices();
  void checkAutomaticFiles();
  void checkAutomaticVoices();
});
let groupRequest = 0;
watch([gameMode, windowsReady, dosReady], async ([mode, hasWindows, hasDos]) => {
  // Keep the chosen edition when available, and use the only installed
  // edition temporarily if the preferred one is missing.
  const desired: GameMode | null = hasWindows && hasDos ? gameModePreference.value ?? 'windows'
    : hasWindows ? 'windows' : hasDos ? 'dos' : null;
  if (desired && mode !== desired) {
    ++groupRequest;
    groups.value = [];
    modeMessage.value = writeGameMode(desired, false) ? '' : 'Game mode changed for this visit, but this browser could not save your preference.';
    gameMode.value = desired;
    return;
  }
  const generation = ++groupRequest;
  if (mode === 'windows' && !hasWindows) { groups.value = []; return; }
  try {
    const config = await new GameFactory(`${import.meta.env.BASE_URL}data`, mode).getConfig(GameTypes.LEMMINGS);
    if (disposed || generation !== groupRequest) return;
    groups.value = config ? config.level.groups.map((name, index) => ({ name, count: config.level.getGroupLength(index) })) : [];
    progress.value = readProgress(mode);
    selectLastLevel();
  } catch { if (!disposed && generation === groupRequest) groups.value = []; }
}, { immediate: true });
async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  manualGeneration++; readinessGeneration++;
  busy.value = true; message.value = '';
  try { await importLemmingsFiles(input.files); dosReady.value = true; message.value = 'Game files added. You’re ready to play!'; void checkAutomaticVoices(); }
  catch (error) { message.value = error instanceof Error ? error.message : 'Could not read those files. Please try again.'; }
  finally { input.value = ''; busy.value = false; void refreshReadiness(); }
}
async function removeFiles() {
  manualGeneration++; readinessGeneration++;
  busy.value = true; message.value = '';
  try { await clearLemmingsFiles(); dosReady.value = false; message.value = 'Game files removed from this browser.'; }
  catch { message.value = 'Could not remove the game files. Please try again.'; }
  finally { busy.value = false; void refreshReadiness(); void refreshVoices(); }
}
async function refreshVoices() {
  const generation = ++voiceReadinessGeneration;
  try {
    const [voices, audio, graphics, game, standalone] = await Promise.all([hasWindowsVoiceFiles(), hasWindowsAudioFiles(), hasWindowsGraphics(), hasWindowsGame(), hasStandaloneWindowsGraphics()]);
    if (!disposed && generation === voiceReadinessGeneration) { voicesReady.value = voices; audioReady.value = audio; graphicsReady.value = graphics; windowsGameReady.value = game; standaloneGraphicsReady.value = standalone; }
  } catch {
    if (!disposed && generation === voiceReadinessGeneration) { voicesReady.value = false; audioReady.value = false; graphicsReady.value = false; windowsGameReady.value = false; standaloneGraphicsReady.value = false; }
  }
}
async function checkAutomaticVoices() {
  if (windowsCheck) return windowsCheck;
  const check = async () => {
    windowsSetup.value = 'checking';
    try {
      if (!initialWindowsSetup) initialWindowsSetup = allowBundledWindowsOnReload(() => !disposed && voiceManualGeneration === 0);
      try { await initialWindowsSetup; }
      catch (error) { initialWindowsSetup = undefined; throw error; }
      const results = await Promise.allSettled([importBundledWindowsVoices(), importBundledWindowsGraphics(), importBundledWindowsGame()]);
      await refreshVoices();
      if (!disposed) {
        const values = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
        const incomplete = !windowsReady.value && values.includes('absent') && values.some(value => value === 'imported' || value === 'existing');
        windowsSetup.value = results.some(result => result.status === 'rejected') || incomplete ? 'failed' : 'done';
      }
    } catch {
      if (!disposed) windowsSetup.value = 'failed';
    }
  };
  windowsCheck = check();
  try { await windowsCheck; } finally { windowsCheck = undefined; }
}
async function onVoicesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  voiceManualGeneration++; voiceReadinessGeneration++; voiceBusy.value = true; voiceMessage.value = '';
  try {
    const imported = await importWindowsFiles(input.files);
    await refreshVoices();
    const parts = [imported.audio && 'audio', imported.graphics && 'graphics', imported.game && 'level data'].filter(Boolean);
    const description = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
    voiceMessage.value = `Windows ${description} added to this device.`;
  }
  catch (error) { voiceMessage.value = `${error instanceof Error ? error.message : 'Could not read those Windows files.'} Your existing Windows files were not changed.`; }
  finally { input.value = ''; voiceBusy.value = false; }
}
async function removeVoices() {
  voiceManualGeneration++; voiceReadinessGeneration++; voiceBusy.value = true; voiceMessage.value = '';
  try {
    await clearWindowsFiles();
    await refreshVoices();
    if (gameMode.value === 'windows') {
      modeMessage.value = writeGameMode('dos', false) ? '' : 'Game mode changed for this visit, but this browser could not save your preference.';
      gameMode.value = 'dos';
    }
    voiceMessage.value = 'Windows files removed from this browser. If this site provides them, refresh to restore them.';
  }
  catch { voiceMessage.value = 'Could not remove the Windows files. Please try again.'; }
  finally { voiceBusy.value = false; }
}
function onGameModeChange(event: Event) {
  const select = event.target as HTMLSelectElement;
  const mode = select.value;
  if ((mode !== 'dos' && mode !== 'windows') || (mode === 'windows' && !windowsReady.value) || (mode === 'dos' && !dosReady.value)) {
    select.value = gameMode.value;
    voiceMessage.value = 'Could not select that game mode. Check the game files and browser storage.';
    return;
  }
  modeMessage.value = writeGameMode(mode) ? '' : 'Game mode changed for this visit, but this browser could not save your preference.';
  gameModePreference.value = mode;
  gameMode.value = mode;
  voiceMessage.value = '';
}
function downloadBackup() {
  backupMessage.value = '';
  try {
    const url = URL.createObjectURL(new Blob([exportProgressBackup()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lemmings-progress.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    backupMessage.value = 'Progress backup downloaded. Your game files were not included.';
  } catch {
    backupMessage.value = 'Could not export your progress. Check browser storage and try again.';
  }
}
async function onBackupSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  busy.value = true; backupMessage.value = '';
  try {
    if (file.size > 64 * 1024) throw new Error('This backup file is too large.');
    if (!restoreProgressBackup(await file.text())) throw new Error('Could not save progress on this device. Check browser storage and try again.');
    progress.value = readProgress(gameMode.value);
    selectLastLevel();
    backupMessage.value = 'Progress and settings restored. Your game files were not changed.';
  } catch (error) {
    backupMessage.value = error instanceof Error ? error.message : 'Could not read this progress backup.';
  } finally { input.value = ''; busy.value = false; void refreshReadiness(); }
}
</script>

<style scoped>
/* Hallmark · checked: 2026-10-29 · genre: playful (inferred)
 * built: the project · redesign: polish · scope: app · v2.0.0
 * static: 0 FAIL · answered F1: preserve the tested heading copy; rendered review pending
 * preserved: local artwork, import, level selection and backups */
.home {
  min-height: 100vh;
  background: var(--color-ground);
  color: var(--color-ink);
  font-family: var(--font-body);
}
.home-inner { max-width: var(--content-width); margin: auto; padding: 0 2rem; }
.topbar { min-height: 64px; display: flex; align-items: center; border-bottom: 1px solid var(--color-edge); }
.brand { color: var(--color-ink); font-size: 1rem; font-weight: 800; }
.brand span { color: var(--color-muted); font: inherit; }
.hero { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2rem; align-items: center; padding: 2.5rem 0; }
.hero-copy { min-width: 0; }
h1 { margin: 0 0 1rem; font-size: 2rem; font-weight: 800; line-height: 1.2; text-wrap: balance; overflow-wrap: break-word; min-width: 0; }
.intro { color: var(--color-muted); max-width: 34rem; margin: 0 0 .75rem; font-size: 1rem; line-height: 1.6; }
.preview-note { color: var(--color-muted); font-size: .875rem; line-height: 1.5; margin: .75rem 0; }
.actions { margin-top: 1.5rem; }
.edition-link { display: flex; align-items: center; width: fit-content; min-height: 44px; margin-top: .5rem; color: var(--color-muted); font-size: .875rem; text-underline-offset: .2em; }
.level-picker { display: flex; flex-wrap: wrap; gap: 1rem; max-width: 28rem; margin-bottom: 1rem; }
.level-picker label { display: flex; flex: 1 1 120px; min-width: 0; flex-direction: column; gap: .5rem; color: var(--color-ink); font-size: .875rem; font-weight: 600; }
.level-picker select, .game-mode select { min-width: 0; min-height: 48px; padding: .6rem; border: 2px solid; border-color: var(--color-edge-dark) var(--color-edge) var(--color-edge) var(--color-edge-dark); border-radius: 2px; background: var(--color-panel); color: var(--color-ink); font: inherit; }
.level-picker select, .game-mode select { width: 100%; }
.game-mode { display: flex; flex-direction: column; gap: .5rem; max-width: 28rem; margin-bottom: 1rem; color: var(--color-ink); font-size: .875rem; font-weight: 600; }
.best-score { color: var(--color-muted); font-size: .875rem; margin: 0 0 1rem; }
.primary-button { display: inline-flex; align-items: center; justify-content: center; min-height: 52px; padding: .75rem 1.5rem; border: 2px solid; border-color: var(--color-edge-light) var(--color-edge-dark) var(--color-edge-dark) var(--color-edge-light); border-radius: 2px; background: var(--color-accent); color: var(--color-accent-ink); font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; white-space: nowrap; }
.primary-button:hover:not(:disabled) { box-shadow: inset 0 0 0 2px var(--color-accent-ink); }
.primary-button:active:not(:disabled) { border-color: var(--color-edge-dark) var(--color-edge-light) var(--color-edge-light) var(--color-edge-dark); }
.primary-button:disabled { background: var(--color-panel); color: var(--color-muted); border-color: var(--color-edge-dark); cursor: wait; }
.ready-note, .hint { color: var(--color-muted); font-size: .875rem; line-height: 1.5; margin: 1rem 0 0; }
.offline-note { color: var(--color-muted); font-size: .875rem; line-height: 1.5; margin: .5rem 0 0; }
.status-message { font-variant-numeric: tabular-nums; color: var(--color-ink); font-size: .875rem; line-height: 1.5; }
.folder-button { display: block; }
.hero-art { position: relative; min-height: 320px; display: grid; place-items: center; padding: 1rem; overflow: hidden; border: 2px solid; border-color: var(--color-edge-light) var(--color-edge-dark) var(--color-edge-dark) var(--color-edge-light); background: var(--color-panel); }
.art-frame { width: 100%; max-width: 510px; }
.art-topline, .art-bottomline { min-height: 28px; display: flex; align-items: center; justify-content: space-between; gap: .75rem; color: var(--color-muted); font-size: .875rem; line-height: 1.3; }
.art-bottomline { padding-top: .5rem; }
.art-screen { position: relative; min-height: 230px; overflow: hidden; background: var(--color-art-depth); }
.original-background { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; opacity: .8; }
.original-logo { position: absolute; width: min(94%, 480px); height: auto; left: 50%; top: 50%; transform: translate(-50%, -50%); image-rendering: pixelated; filter: drop-shadow(2px 3px 0 var(--color-art-shadow)); }
.fallback-landscape { position: absolute; inset: 0; background: var(--color-art-sky); }
.fallback-landscape.is-hidden { display: none; }
.pixel-sun { position: absolute; top: 15%; right: 16%; width: 32px; height: 32px; background: var(--color-art-sun); box-shadow: 8px 0 var(--color-art-sun), -8px 0 var(--color-art-sun), 0 8px var(--color-art-sun), 0 -8px var(--color-art-sun); }
.pixel-mountain { position: absolute; left: 0; right: 0; bottom: 0; }
.mountain-back { height: 62%; background: var(--color-art-mountain-back); clip-path: polygon(0 100%, 0 67%, 12% 67%, 12% 51%, 24% 51%, 24% 35%, 34% 35%, 34% 19%, 43% 19%, 43% 36%, 53% 36%, 53% 52%, 64% 52%, 64% 40%, 74% 40%, 74% 55%, 87% 55%, 87% 69%, 100% 69%, 100% 100%); }
.mountain-front { height: 32%; background: var(--color-art-mountain-front); clip-path: polygon(0 100%, 0 42%, 18% 42%, 18% 25%, 36% 25%, 36% 45%, 59% 45%, 59% 28%, 77% 28%, 77% 47%, 100% 47%, 100% 100%); }
.pixel-platform { position: absolute; bottom: 25%; left: 13%; width: 31%; height: 12px; border-top: 4px solid var(--color-art-grass); background: var(--color-art-earth); box-shadow: 0 7px var(--color-art-earth-shadow); }
.pixel-steps { position: absolute; right: 17%; bottom: 25%; width: 12px; height: 10px; background: var(--color-art-steps); box-shadow: -12px 6px var(--color-art-steps), -24px 12px var(--color-art-steps), -36px 18px var(--color-art-steps), -48px 24px var(--color-art-steps); }
.fallback-caption { position: absolute; left: 1rem; bottom: .75rem; color: var(--color-ink); font-size: .875rem; line-height: 1.3; }
.setup { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2rem; border-top: 1px solid var(--color-edge); padding: 1.5rem 0; }
h2 { margin: 0; font-size: 1.25rem; font-weight: 700; line-height: 1.4; text-wrap: balance; overflow-wrap: break-word; }
.setup-detail { color: var(--color-muted); font-size: .875rem; line-height: 1.7; }
.setup-detail p { margin: 0; }
.setup-detail p + p { margin-top: .5rem; }
.text-button { min-height: 44px; margin: .75rem 0 0; padding: .5rem .75rem; border: 2px solid; border-color: var(--color-edge) var(--color-edge-dark) var(--color-edge-dark) var(--color-edge); border-radius: 2px; background: none; color: var(--color-ink); cursor: pointer; font: inherit; text-decoration: none; }
.text-button:hover:not(:disabled) { background: var(--color-panel-raised); }
.text-button:active:not(:disabled) { border-color: var(--color-edge-dark) var(--color-edge) var(--color-edge) var(--color-edge-dark); }
.text-button:disabled { background: var(--color-surface); color: var(--color-muted); border-color: var(--color-edge-dark); cursor: wait; }
.backup-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
footer { display: flex; flex-wrap: wrap; gap: .5rem 1.5rem; align-items: center; padding: 1rem 0; border-top: 1px solid var(--color-edge); color: var(--color-muted); font-size: .875rem; }
footer a { display: inline-flex; min-height: 44px; align-items: center; color: var(--color-ink); text-underline-offset: .2em; }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.primary-button:focus-visible, .text-button:focus-visible, .edition-link:focus-visible, select:focus-visible, footer a:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
.is-ready .hero { padding-block: 2rem; }
@media (max-width: 720px) {
  .home-inner { padding-inline: 1rem; }
  .topbar { min-height: 56px; }
  .hero { grid-template-columns: minmax(0, 1fr); padding-block: 1.5rem; gap: 1.5rem; }
  .is-ready .hero { padding-block: 1.5rem; }
  h1 { font-size: 1.75rem; }
  .hero-art { min-height: 220px; padding: .75rem; }
  .art-screen { min-height: 160px; }
  .setup { grid-template-columns: minmax(0, 1fr); gap: .5rem; }
  .primary-button { width: 100%; }
  .level-picker { max-width: none; gap: .75rem; }
  .game-mode { max-width: none; }
}
</style>
