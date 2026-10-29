<template>
  <main class="home">
    <div class="home-inner">
      <header class="topbar"><span class="brand-mark" aria-hidden="true">L</span><span class="brand">LEMMINGS <span>TS</span></span></header>
      <section class="hero" aria-labelledby="welcome-title">
        <div class="hero-copy">
          <p class="eyebrow"><span aria-hidden="true">▶</span> {{ ready ? 'SELECT YOUR LEVEL' : 'WELCOME, PLAYER' }}</p>
          <h1 id="welcome-title">Let's get them <em>home.</em></h1>
          <p class="intro">{{ ready ? 'Choose a difficulty and level, then lead your lemmings to the exit.' : 'Add your original DOS game files to unlock 120 levels.' }}</p>
          <p class="preview-note">Early preview · Testing on different devices is still underway.</p>
          <div v-if="ready" class="actions">
            <div class="level-picker" v-if="groups.length">
              <label>Difficulty <select v-model.number="selectedGroup" @change="selectedLevel = 0"><option v-for="(group, index) in groups" :key="group.name" :value="index">{{ group.name }}</option></select></label>
              <label>Level <select v-model.number="selectedLevel"><option v-for="index in groups[selectedGroup].count" :key="index" :value="index - 1">{{ index }}{{ bestScore(selectedGroup, index - 1) === null ? '' : ` · best ${bestScore(selectedGroup, index - 1)}%` }}</option></select></label>
            </div>
            <p v-if="bestScore(selectedGroup, selectedLevel) !== null" class="best-score">Best saved: {{ bestScore(selectedGroup, selectedLevel) }}%</p>
            <router-link class="primary-button" :to="{ name: 'game', params: { gameType: 1 }, query: { group: selectedGroup, level: selectedLevel } }">Play Lemmings <span aria-hidden="true">→</span></router-link>
            <p class="ready-note"><span aria-hidden="true">●</span> Your game files are ready on this device</p>
          </div>
          <div v-else class="actions">
            <button class="primary-button" type="button" :disabled="busy" @click="fileInput?.click()">{{ busy ? 'Getting things ready…' : 'Add your game files' }} <span aria-hidden="true">→</span></button>
            <button class="text-button folder-button" type="button" :disabled="busy" @click="folderInput?.click()">Or choose a folder</button>
            <p class="hint">A one-time setup using your original DOS Lemmings files or a ZIP archive.</p>
          </div>
          <p class="offline-note" role="status">{{ offlineReadiness === 'checking' ? 'Preparing offline play…' : offlineReadiness === 'ready' ? (ready ? 'The app shell is ready offline; your game files are stored on this device.' : 'The app shell is ready offline. Add your game files to play.') : 'Offline play may be unavailable. Reconnect and reopen the app.' }}</p>
          <p v-if="checkingAutomaticFiles && !ready" class="offline-note" role="status">Checking for game files supplied by this installation. You can also add your own files now.</p>
          <input ref="fileInput" class="visually-hidden" type="file" multiple tabindex="-1" aria-hidden="true" @change="onFilesSelected" />
          <input ref="folderInput" class="visually-hidden" type="file" webkitdirectory multiple tabindex="-1" aria-hidden="true" @change="onFilesSelected" />
          <p v-if="message" class="status-message" role="status">{{ message }}</p>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="art-frame">
            <div class="art-topline"><span>LEMMINGS TS</span><span>120 LEVELS</span></div>
            <div class="art-screen">
              <div class="fallback-landscape" :class="{ 'is-hidden': artworkReady }">
                <span class="pixel-sun"></span><span class="pixel-mountain mountain-back"></span><span class="pixel-mountain mountain-front"></span>
                <span class="pixel-platform"></span><span class="pixel-steps"></span>
                <span class="fallback-caption">A LITTLE ADVENTURE AWAITS</span>
              </div>
              <canvas ref="backgroundCanvas" v-show="artworkReady" class="original-background" data-home-background></canvas>
              <canvas ref="logoCanvas" v-show="artworkReady" class="original-logo" data-home-logo></canvas>
            </div>
            <div class="art-bottomline"><span>YOUR ADVENTURE</span><span>PRESS PLAY <b>▶</b></span></div>
          </div>
        </div>
      </section>
      <section class="setup" aria-labelledby="setup-title">
        <div><p class="section-label">{{ ready ? 'FILES READY' : 'ONE-TIME SETUP' }}</p><h2 id="setup-title">{{ ready ? 'Your game, on this device' : 'Bring your own game' }}</h2></div>
        <div class="setup-detail">
          <p v-if="ready">Your original files are stored in this browser, ready for your next adventure. They stay on this device.</p>
          <p v-else>Select the original Lemmings <strong>.dat</strong> files together, or choose a ZIP containing them. They’re stored in this browser, not uploaded. You’ll need to add them separately on each device.</p>
          <button v-if="ready" class="text-button" type="button" :disabled="busy" @click="removeFiles">Remove game files</button>
        </div>
      </section>
      <section class="setup backup" aria-labelledby="backup-title">
        <div><p class="section-label">KEEP YOUR PROGRESS</p><h2 id="backup-title">Progress backup</h2></div>
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
      <footer>Made for a little more play <span aria-hidden="true">✳</span> · <a :href="`${baseUrl}third-party.html`">Source and licences</a></footer>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { clearLemmingsFiles, hasLemmingsFiles, importLemmingsFiles } from '@/game/resources/file/game-file-store';
import { importBundledLemmingsFiles } from '@/game/resources/file/bundled-game-import';
import { GameFactory } from '@/game/game-factory';
import { GameTypes } from '@/game/game-types';
import { exportProgressBackup, readLastLevel, readProgress, restoreProgressBackup } from '@/game/progress';
import { loadHomeArtwork, paintHomeArtwork } from '@/game/resources/home-artwork';
import { offlineReadiness } from '@/offline-readiness';

const baseUrl = import.meta.env.BASE_URL;

const ready = ref(false);
const busy = ref(false);
const checkingAutomaticFiles = ref(true);
const message = ref('');
const backupMessage = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const folderInput = ref<HTMLInputElement | null>(null);
const backupInput = ref<HTMLInputElement | null>(null);
const logoCanvas = ref<HTMLCanvasElement | null>(null);
const backgroundCanvas = ref<HTMLCanvasElement | null>(null);
const artworkReady = ref(false);
let artworkRequest = 0;
let disposed = false;
let manualGeneration = 0;
let readinessGeneration = 0;

watch(ready, async (hasFiles) => {
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
onBeforeUnmount(() => { artworkRequest++; disposed = true; readinessGeneration++; });
const groups = ref<{ name: string; count: number }[]>([]);
const selectedGroup = ref(0);
const selectedLevel = ref(0);
const progress = ref(readProgress());
function bestScore(group: number, level: number): number | null {
  return progress.value.find(entry => entry.gameType === GameTypes.LEMMINGS && entry.groupIndex === group && entry.levelIndex === level)?.bestSavedPercent ?? null;
}
function selectLastLevel() {
  const last = readLastLevel();
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
    if (!disposed && generation === readinessGeneration && !busy.value) ready.value = hasFiles;
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
  void checkAutomaticFiles();
  try {
    const config = await new GameFactory(`${import.meta.env.BASE_URL}data`).getConfig(GameTypes.LEMMINGS);
    if (config) {
      groups.value = config.level.groups.map((name, index) => ({ name, count: config.level.getGroupLength(index) }));
      selectLastLevel();
    }
  } catch { if (!disposed && !message.value) message.value = 'The level list could not be loaded. Check your connection and try again.'; }
});
async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  manualGeneration++; readinessGeneration++;
  busy.value = true; message.value = '';
  try { await importLemmingsFiles(input.files); ready.value = true; message.value = 'Game files added. You’re ready to play!'; }
  catch (error) { message.value = error instanceof Error ? error.message : 'Could not read those files. Please try again.'; }
  finally { input.value = ''; busy.value = false; void refreshReadiness(); }
}
async function removeFiles() {
  manualGeneration++; readinessGeneration++;
  busy.value = true; message.value = '';
  try { await clearLemmingsFiles(); ready.value = false; message.value = 'Game files removed from this browser.'; }
  catch { message.value = 'Could not remove the game files. Please try again.'; }
  finally { busy.value = false; void refreshReadiness(); }
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
    progress.value = readProgress();
    selectLastLevel();
    backupMessage.value = 'Progress and settings restored. Your game files were not changed.';
  } catch (error) {
    backupMessage.value = error instanceof Error ? error.message : 'Could not read this progress backup.';
  } finally { input.value = ''; busy.value = false; void refreshReadiness(); }
}
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: #14221f;
  color: #edf3e4;
  font-family: ui-monospace, 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
}
.home-inner { max-width: 1220px; margin: auto; padding: 0 36px; }
.topbar { height: 76px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #395348; }
.brand-mark { display: grid; place-items: center; width: 34px; height: 34px; color: #14291c; background: #9bcc83; border-radius: 4px; box-shadow: 3px 3px 0 #547b51; font-size: 21px; font-weight: 900; }
.brand { color: #edf3e4; font-size: 14px; font-weight: 900; letter-spacing: .08em; }
.brand span { color: #b1c5b2; font: inherit; font-size: 12px; letter-spacing: 0; }
.hero { display: grid; grid-template-columns: 1fr 1fr; gap: 5%; align-items: center; padding: 50px 0 62px; }
.eyebrow, .section-label { color: #a5c7a3; font-size: 11px; font-weight: 800; letter-spacing: .18em; }
.eyebrow span { color: #d99d4d; margin-right: 7px; }
h1 { max-width: 580px; margin: 18px 0; font: 800 clamp(34px, 4.4vw, 58px)/1.08 ui-monospace, 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; letter-spacing: -.05em; }
h1 em { color: #a1d585; font-weight: inherit; font-style: normal; }
.intro { color: #becfc0; max-width: 500px; font-size: 15px; line-height: 1.6; }
.preview-note { color: #dbc99d; font-size: 12px; line-height: 1.5; }
.actions { margin-top: 25px; }
.level-picker { display: flex; flex-wrap: wrap; gap: 12px; max-width: 430px; margin-bottom: 18px; padding: 14px; border: 1px solid #537563; background: #1a3028; box-shadow: 4px 4px 0 #0d1813; }
.level-picker label { display: flex; flex: 1 1 120px; flex-direction: column; gap: 5px; color: #a5c7a3; font-size: 12px; font-weight: 700; }
.level-picker select { width: 100%; min-width: 120px; min-height: 44px; padding: 8px; border: 1px solid #6e8f77; border-radius: 6px; background: #243a32; color: #f5f8ef; font: inherit; }
.best-score { color: #c6e3b9; font-size: 12px; margin: -6px 0 18px; }
.primary-button { display: inline-flex; align-items: center; justify-content: space-between; gap: 48px; min-height: 54px; padding: 14px 18px; border: 0; border-radius: 5px; background: #99ca7b; color: #12241a; font: inherit; font-size: 15px; font-weight: 750; text-decoration: none; cursor: pointer; box-shadow: 0 6px 0 #416d4b; }
.primary-button:hover { background: #b6df99; }
.primary-button:disabled { opacity: .6; cursor: wait; }
.ready-note, .hint { color: #acc2b0; font-size: 12px; margin-top: 18px; }
.offline-note { color: #acc2b0; font-size: 12px; line-height: 1.5; }
.ready-note span { color: #6aaf78; margin-right: 5px; }
.status-message { color: #d3edc5; font-size: 14px; line-height: 1.5; }
.folder-button { display: block; }
.hero-art { position: relative; min-height: 390px; display: grid; place-items: center; padding: 22px; overflow: hidden; border-radius: 8px; background: #182a2a; box-shadow: 0 12px 0 #284536; }
.art-frame { width: 100%; max-width: 510px; padding: 10px; border: 1px solid #537665; background: #0d1c1b; box-shadow: 0 0 0 3px #203d32; }
.art-topline, .art-bottomline { min-height: 28px; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #9bc4a4; font: 700 9px/1.3 ui-monospace, monospace; letter-spacing: .12em; }
.art-bottomline { padding-top: 7px; color: #7fa489; }
.art-bottomline b { color: #e7c66e; }
.art-screen { position: relative; min-height: 270px; overflow: hidden; border: 2px solid #547a5b; background: #050c0a; }
.original-background { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; opacity: .8; }
.original-logo { position: absolute; width: min(94%, 480px); height: auto; left: 50%; top: 50%; transform: translate(-50%, -50%); image-rendering: pixelated; filter: drop-shadow(2px 3px 0 #000); }
.fallback-landscape { position: absolute; inset: 0; background: linear-gradient(#182e34 0 58%, #182823 58%); }
.fallback-landscape.is-hidden { display: none; }
.pixel-sun { position: absolute; top: 15%; right: 16%; width: 32px; height: 32px; background: #d5bb77; box-shadow: 8px 0 #d5bb77, -8px 0 #d5bb77, 0 8px #d5bb77, 0 -8px #d5bb77; }
.pixel-mountain { position: absolute; left: 0; right: 0; bottom: 0; }
.mountain-back { height: 62%; background: #344d3d; clip-path: polygon(0 100%, 0 67%, 12% 67%, 12% 51%, 24% 51%, 24% 35%, 34% 35%, 34% 19%, 43% 19%, 43% 36%, 53% 36%, 53% 52%, 64% 52%, 64% 40%, 74% 40%, 74% 55%, 87% 55%, 87% 69%, 100% 69%, 100% 100%); }
.mountain-front { height: 32%; background: #253a2c; clip-path: polygon(0 100%, 0 42%, 18% 42%, 18% 25%, 36% 25%, 36% 45%, 59% 45%, 59% 28%, 77% 28%, 77% 47%, 100% 47%, 100% 100%); }
.pixel-platform { position: absolute; bottom: 25%; left: 13%; width: 31%; height: 12px; border-top: 4px solid #90b66a; background: #76513d; box-shadow: 0 7px #4c3329; }
.pixel-steps { position: absolute; right: 17%; bottom: 25%; width: 12px; height: 10px; background: #d2bd83; box-shadow: -12px 6px #d2bd83, -24px 12px #d2bd83, -36px 18px #d2bd83, -48px 24px #d2bd83; }
.fallback-caption { position: absolute; left: 18px; bottom: 14px; color: #9eb7a1; font: 700 9px/1.3 ui-monospace, monospace; letter-spacing: .11em; }
.setup { display: grid; grid-template-columns: 1fr 1fr; gap: 6%; border-top: 1px solid #395348; padding: 34px 0; }
h2 { margin: 10px 0; font: 750 21px/1.3 ui-monospace, 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; letter-spacing: -.03em; }
.setup-detail { color: #becfc0; font-size: 14px; line-height: 1.7; }
.setup-detail p { margin: 0; }
.text-button { margin: 12px 0 0; padding: 0; border: 0; background: none; color: #a9d99b; text-decoration: underline; cursor: pointer; font: inherit; }
.backup-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.backup-actions .text-button { min-height: 44px; padding: 8px 12px; border: 1px solid #73967c; background: #243a32; text-decoration: none; box-shadow: 3px 3px 0 #0d1813; }
.backup-actions .text-button:hover:not(:disabled) { background: #345345; }
.backup-actions .text-button:disabled { opacity: .55; cursor: wait; }
footer { padding: 24px 0; border-top: 1px solid #395348; color: #b1c5b2; font-size: 12px; }
footer span { color: #d3a059; }
footer a { color: #a9d99b; }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.primary-button:focus-visible, .text-button:focus-visible, select:focus-visible, footer a:focus-visible { outline: 3px solid #f2ce7d; outline-offset: 3px; }
@media (max-width: 720px) {
  .home-inner { padding: 0 22px; }
  .topbar { height: 72px; }
  .hero { grid-template-columns: 1fr; padding: 46px 0 50px; gap: 40px; }
  .hero-art { min-height: 280px; padding: 16px; }
  .art-screen { min-height: 220px; }
  .setup { grid-template-columns: 1fr; gap: 8px; }
  .intro { font-size: 16px; }
}
</style>
