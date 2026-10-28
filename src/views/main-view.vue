<template>
  <main class="home">
    <div class="home-inner">
      <header class="topbar"><span class="brand-mark" aria-hidden="true">L</span><span class="brand">LEMMINGS <span>at home</span></span></header>
      <section class="hero" aria-labelledby="welcome-title">
        <div class="hero-copy">
          <p class="eyebrow"><span aria-hidden="true">✦</span> A LITTLE ADVENTURE AWAITS</p>
          <h1 id="welcome-title">Let's get them <em>home.</em></h1>
          <p class="intro">A little bit of chaos, a lot of tiny lemmings, and a whole world of puzzles to solve.</p>
          <p class="preview-note">Early preview · Gameplay and level solutions are still being verified.</p>
          <div v-if="ready" class="actions">
            <div class="level-picker" v-if="groups.length">
              <label>Difficulty <select v-model.number="selectedGroup" @change="selectedLevel = 0"><option v-for="(group, index) in groups" :key="group.name" :value="index">{{ group.name }}</option></select></label>
              <label>Level <select v-model.number="selectedLevel"><option v-for="index in groups[selectedGroup].count" :key="index" :value="index - 1">{{ index }}{{ isComplete(selectedGroup, index - 1) ? ' ✓' : '' }}</option></select></label>
            </div>
            <router-link class="primary-button" :to="{ name: 'game', params: { gameType: 1 }, query: { group: selectedGroup, level: selectedLevel } }">Play Lemmings <span aria-hidden="true">→</span></router-link>
            <p class="ready-note"><span aria-hidden="true">●</span> Your game files are ready on this device</p>
          </div>
          <div v-else class="actions">
            <button class="primary-button" type="button" :disabled="busy" @click="fileInput?.click()">{{ busy ? 'Getting things ready…' : 'Add your game files' }} <span aria-hidden="true">→</span></button>
            <button class="text-button folder-button" type="button" :disabled="busy" @click="folderInput?.click()">Or choose a folder</button>
            <p class="hint">A one-time setup using your original DOS Lemmings files.</p>
          </div>
          <input ref="fileInput" class="visually-hidden" type="file" multiple @change="onFilesSelected" />
          <input ref="folderInput" class="visually-hidden" type="file" webkitdirectory multiple @change="onFilesSelected" />
          <p v-if="message" class="status-message" role="status">{{ message }}</p>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="sun"></div><div class="cloud cloud-one"></div><div class="cloud cloud-two"></div>
          <div class="art-hill hill-back"></div><div class="art-hill hill-front"></div>
          <div class="lemming lemming-one"></div><div class="lemming lemming-two"></div><div class="lemming lemming-three"></div>
          <div class="art-label">A CLASSIC, REIMAGINED <span>✦</span></div>
        </div>
      </section>
      <section class="setup" aria-labelledby="setup-title">
        <div><p class="section-label">{{ ready ? 'READY TO GO' : 'FIRST THINGS FIRST' }}</p><h2 id="setup-title">{{ ready ? 'Your lemmings are waiting' : 'Bring your own game' }}</h2></div>
        <div class="setup-detail">
          <p v-if="ready">Your original files are stored in this browser, ready for your next adventure. They stay on this device.</p>
          <p v-else>Select the original Lemmings <strong>.dat</strong> files together from your device. They’re stored in this browser, not uploaded. You’ll need to add them separately on each device.</p>
          <button v-if="ready" class="text-button" type="button" :disabled="busy" @click="removeFiles">Remove game files</button>
        </div>
      </section>
      <footer>Made for a little more play <span aria-hidden="true">✳</span></footer>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { clearLemmingsFiles, hasLemmingsFiles, importLemmingsFiles } from '@/game/resources/file/game-file-store';
import { GameFactory } from '@/game/game-factory';
import { GameTypes } from '@/game/game-types';
import { readProgress } from '@/game/progress';

const ready = ref(false);
const busy = ref(true);
const message = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const folderInput = ref<HTMLInputElement | null>(null);
const groups = ref<{ name: string; count: number }[]>([]);
const selectedGroup = ref(0);
const selectedLevel = ref(0);
const progress = readProgress();
function isComplete(group: number, level: number) {
  return progress.some(entry => entry.gameType === GameTypes.LEMMINGS && entry.groupIndex === group && entry.levelIndex === level);
}
onMounted(async () => {
  try { ready.value = await hasLemmingsFiles(); }
  catch { message.value = 'This browser could not access local storage. Check your browser settings and try again.'; }
  try {
    const config = await new GameFactory(`${import.meta.env.BASE_URL}data`).getConfig(GameTypes.LEMMINGS);
    if (config) groups.value = config.level.groups.map((name, index) => ({ name, count: config.level.getGroupLength(index) }));
  } catch { message.value = 'The level list could not be loaded. Check your connection and try again.'; }
  finally { busy.value = false; }
});
async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  busy.value = true; message.value = '';
  try { await importLemmingsFiles(input.files); ready.value = true; message.value = 'Game files added. You’re ready to play!'; }
  catch (error) { message.value = error instanceof Error ? error.message : 'Could not read those files. Please try again.'; }
  finally { input.value = ''; busy.value = false; }
}
async function removeFiles() {
  busy.value = true; message.value = '';
  try { await clearLemmingsFiles(); ready.value = false; message.value = 'Game files removed from this browser.'; }
  catch { message.value = 'Could not remove the game files. Please try again.'; }
  finally { busy.value = false; }
}
</script>

<style scoped>
.home { min-height: 100vh; background: #f7f5ec; color: #1e3028; }
.home-inner { max-width: 1220px; margin: auto; padding: 0 36px; }
.topbar { height: 90px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #d9ded1; }
.brand-mark { display: grid; place-items: center; width: 34px; height: 34px; color: #f6f6dc; background: #2a684b; border-radius: 10px; font-size: 21px; font-weight: 900; }
.brand { font-weight: 900; letter-spacing: .13em; font-size: 14px; }.brand span { font-family: Georgia, serif; font-size: 13px; font-style: italic; letter-spacing: 0; font-weight: 400; color: #77847a; }
.hero { display: grid; grid-template-columns: 1fr 1fr; gap: 6%; align-items: center; padding: 75px 0 86px; }
.eyebrow, .section-label { color: #648171; font-size: 11px; font-weight: 800; letter-spacing: .18em; }.eyebrow span { color: #d99d4d; margin-right: 7px; }
h1 { font-family: Georgia, serif; font-size: clamp(52px, 6.3vw, 82px); font-weight: 400; letter-spacing: -.065em; line-height: 1.04; margin: 24px 0; max-width: 620px; } h1 em { color: #36785a; font-weight: 400; }
.intro { color: #718177; font-size: 17px; line-height: 1.7; max-width: 405px; }.actions { margin-top: 34px; }
.preview-note { color: #7b6b47; font-size: 12px; line-height: 1.5; }
.level-picker { display: flex; gap: 12px; margin-bottom: 18px; }.level-picker label { display: flex; flex-direction: column; gap: 5px; color: #648171; font-size: 12px; font-weight: 700; }.level-picker select { min-width: 120px; min-height: 44px; padding: 8px; border: 1px solid #becdbd; border-radius: 6px; background: #fff; color: #1e3028; font: inherit; }
.primary-button { display: inline-flex; align-items: center; justify-content: space-between; gap: 48px; background: #286d4e; color: #fff; padding: 18px 22px; min-height: 58px; border: 0; border-radius: 8px; font: inherit; font-size: 15px; font-weight: 750; text-decoration: none; cursor: pointer; box-shadow: 0 6px 0 #d6e2d3; }.primary-button:hover { background: #205a41; }.primary-button:disabled { opacity: .6; cursor: wait; }
.ready-note, .hint { color: #849087; font-size: 12px; margin-top: 18px; }.ready-note span { color: #6aaf78; margin-right: 5px; }.status-message { color: #315d47; font-size: 14px; line-height: 1.5; }
.folder-button { display: block; }
.hero-art { position: relative; min-height: 390px; overflow: hidden; border-radius: 8px; background: #cce6d9; }.sun { position: absolute; width: 80px; height: 80px; top: 52px; right: 75px; border-radius: 50%; background: #ffeba6; }
.cloud { position: absolute; height: 18px; width: 85px; border-radius: 30px; background: #e9f4e9; opacity: .8; }.cloud:after { content: ''; position: absolute; width: 35px; height: 35px; bottom: 0; left: 20px; background: inherit; border-radius: 50%; }.cloud-one { top: 85px; left: 60px; }.cloud-two { top: 160px; right: 30px; transform: scale(.7); }
.art-hill { position: absolute; width: 150%; height: 260px; border-radius: 50% 50% 0 0; }.hill-back { bottom: -95px; left: -25%; background: #78b38e; transform: rotate(-8deg); }.hill-front { bottom: -145px; left: -20%; background: #488b66; transform: rotate(9deg); }
.lemming { position: absolute; bottom: 81px; width: 24px; height: 30px; background: #3858a0; border-radius: 8px 8px 4px 4px; box-shadow: 0 6px 0 -2px #273c74; }.lemming:before { content: ''; position: absolute; width: 24px; height: 18px; top: -16px; background: #f5d6b7; border-radius: 40%; }.lemming:after { content: ''; position: absolute; width: 28px; height: 11px; top: -19px; left: -2px; background: #68a849; border-radius: 60% 60% 25% 25%; }.lemming-one { left: 30%; }.lemming-two { left: 48%; bottom: 101px; transform: scale(.85); }.lemming-three { left: 65%; bottom: 116px; transform: scale(.7); }
.art-label { position: absolute; bottom: 18px; left: 22px; color: #e8f3e8; font-size: 9px; font-weight: 800; letter-spacing: .17em; }.art-label span { margin-left: 8px; }
.setup { display: grid; grid-template-columns: 1fr 1fr; gap: 6%; border-top: 1px solid #d9ded1; padding: 42px 0; }h2 { font-family: Georgia, serif; font-weight: 400; font-size: 30px; margin: 12px 0; }.setup-detail { color: #718177; font-size: 14px; line-height: 1.7; }.setup-detail p { margin: 0; }.text-button { margin: 12px 0 0; padding: 0; border: 0; background: none; color: #286d4e; text-decoration: underline; cursor: pointer; font: inherit; }
footer { padding: 24px 0; border-top: 1px solid #d9ded1; color: #9ba79c; font-size: 12px; } footer span { color: #d3a059; }.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@media (max-width: 720px) { .home-inner { padding: 0 22px; }.topbar { height: 72px; }.hero { grid-template-columns: 1fr; padding: 46px 0 50px; gap: 40px; }.hero-art { min-height: 280px; }.setup { grid-template-columns: 1fr; gap: 8px; }.intro { font-size: 16px; } }
</style>
