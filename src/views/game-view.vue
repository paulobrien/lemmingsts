<template>
  <main ref="gamePage" class="game-page" :class="{ 'is-fullscreen': fullscreenActive }">
    <header class="game-header">
      <router-link class="back-link" to="/">← Levels</router-link>
      <div>
        <p class="eyebrow">{{ groupName }} · Level {{ levelIndex + 1 }}</p>
        <h1>{{ title }}</h1>
      </div>
      <button class="quiet" type="button" :aria-pressed="musicEnabled" @click="toggleMusic">
        Music {{ musicEnabled ? 'on' : 'off' }}
      </button>
      <button class="quiet" type="button" :aria-pressed="soundEnabled" @click="toggleSound">
        Sound {{ soundEnabled ? 'on' : 'off' }}
      </button>
    </header>

    <div v-if="error" class="notice error" role="alert">{{ error }}</div>
    <p v-else-if="loading" class="notice" role="status">Getting the level ready…</p>
    <p v-else-if="resultMessage" class="notice" role="status">{{ resultMessage }}</p>
    <p v-else class="hint">Tap a skill, then tap a lemming. Drag the level to look around.</p>

    <div class="canvas-frame">
      <canvas ref="gameCanvas" width="800" height="480" aria-label="Lemmings level. Drag to move the view.">
        Your browser does not support the game canvas.
      </canvas>
    </div>

    <div class="game-toolbar" aria-label="Level controls">
      <button v-if="!playing && !finished" class="primary" type="button" :disabled="!canPlay" @click="start">Start level</button>
      <button v-else-if="playing && !paused" ref="pauseControl" class="primary" type="button" aria-controls="pause-menu" :aria-expanded="paused" @click="openPauseMenu">Pause</button>
      <button v-if="finished" class="primary" type="button" @click="loadLevel">Try again</button>
      <button type="button" :disabled="loading || !level" @click="loadLevel">Restart</button>
      <button type="button" aria-label="Zoom out" @click="zoom(-1)">−</button>
      <button type="button" aria-label="Zoom in" @click="zoom(1)">+</button>
      <button v-if="!paused" type="button" :aria-pressed="fullscreenActive" @click="toggleFullscreen">{{ fullscreenActive ? 'Exit fullscreen' : 'Fullscreen' }}</button>
      <label class="speed">Speed
        <select :value="speed" @change="onSpeedChange">
          <option :value="1">1×</option><option :value="2">2×</option><option :value="4">4×</option>
        </select>
      </label>
      <span v-if="playing || finished" class="time">{{ gameTime }}</span>
    </div>

    <p v-if="fullscreenMode === 'expanded'" class="fullscreen-status" role="status">Expanded view (browser fullscreen unavailable)</p>

    <section v-if="playing && paused" id="pause-menu" class="pause-menu" role="region" aria-labelledby="pause-menu-heading">
      <h2 id="pause-menu-heading" ref="pauseHeading" tabindex="-1">Paused</h2>
      <p>The game is paused. You can still select skills and inspect the level.</p>
      <div class="pause-actions">
        <button class="primary" type="button" @click="resumeFromMenu">Resume</button>
        <button type="button" @click="restartFromMenu">Restart level</button>
        <router-link class="pause-link" to="/">Level selection</router-link>
        <button type="button" :aria-pressed="fullscreenActive" @click="toggleFullscreen">{{ fullscreenActive ? 'Exit fullscreen' : 'Fullscreen' }}</button>
      </div>
    </section>

    <section v-if="playing || finished" class="skill-section" aria-label="Lemming skills">
      <div class="skill-grid">
        <button v-for="skill in skillButtons" :key="skill.type" type="button" class="skill-button"
          :class="{ selected: selectedSkill === skill.type }" :aria-pressed="selectedSkill === skill.type"
          :disabled="finished" @click="selectSkill(skill.type)">
          <span>{{ skill.name }}</span><strong>{{ skillCounts[skill.type] ?? 0 }}</strong>
        </button>
      </div>
      <div class="release-controls">
        <span>Release rate: {{ releaseRate }}</span>
        <button type="button" aria-label="Decrease release rate" :disabled="finished" @click="changeReleaseRate(-1)">−</button>
        <button type="button" aria-label="Increase release rate" :disabled="finished" @click="changeReleaseRate(1)">+</button>
        <button type="button" :disabled="finished" @click="confirmNuke">{{ nukeArmed ? 'Confirm nuke' : 'Nuke' }}</button>
        <button v-if="nukeArmed" type="button" @click="nukeArmed = false">Cancel</button>
      </div>
    </section>

    <section v-if="hints.length && !loading && !error" class="hints" aria-label="Hints">
      <button v-if="visibleHintCount < hints.length" type="button" @click="visibleHintCount++">{{ visibleHintCount ? 'Another hint' : 'Show a hint' }}</button>
      <button v-if="visibleHintCount" type="button" @click="visibleHintCount = 0">Hide hints</button>
      <ol v-if="visibleHintCount" aria-live="polite"><li v-for="hint in hints.slice(0, visibleHintCount)" :key="hint">{{ hint }}</li></ol>
    </section>

    <nav class="level-navigation" aria-label="Level navigation">
      <button type="button" :disabled="loading" @click="changeLevel(-1)">← Previous level</button>
      <button type="button" :disabled="loading" @click="changeLevel(1)">Next level →</button>
    </nav>
  </main>
</template>

<script lang="ts" src="./game-view.ts"></script>

<style scoped>
.game-page { max-width: 1080px; min-height: 100vh; box-sizing: border-box; padding: 1rem; margin: 0 auto; color: #f3f3e3; background: #18251c; text-align: left; }
.game-header { display: flex; align-items: center; gap: 1rem; margin-bottom: .75rem; }
.game-header > div { flex: 1; min-width: 0; }
h1 { font-size: clamp(1.2rem, 3vw, 2rem); margin: .1rem 0; line-height: 1.15; }
.eyebrow { color: #c0e7a6; text-transform: uppercase; font-size: .7rem; letter-spacing: .12em; margin: 0; font-weight: bold; }
.back-link { color: #d5f6c4; white-space: nowrap; }
.hint, .notice { color: #d9dfd0; min-height: 1.4rem; margin: .5rem 0; }
.error { color: #ffd3b8; }
.canvas-frame { background: #000; border: 4px solid; border-color: #999a87 #34382f #34382f #999a87; overflow: hidden; }
canvas { display: block; width: 100%; height: auto; aspect-ratio: 5 / 3; image-rendering: pixelated; touch-action: none; }
button, select { min-height: 44px; padding: .55rem .8rem; border-radius: 2px; border: 2px solid; border-color: #a4a894 #292d26 #292d26 #a4a894; color: #f9f9ea; background: #4a4d41; font: inherit; cursor: pointer; }
button:hover:not(:disabled) { background: #5c6050; }
button:focus-visible, select:focus-visible { outline: 2px solid #c4f79e; outline-offset: 2px; }
button:disabled { cursor: default; opacity: .45; }
button.primary { background: #b0df8e; color: #172417; border-color: #d9f4bd #527a43 #527a43 #d9f4bd; font-weight: bold; }
button.primary:hover:not(:disabled) { background: #c4eca7; }
button.quiet { background: transparent; }
.game-toolbar, .release-controls, .level-navigation { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin-top: .75rem; padding: .45rem; border: 2px solid; border-color: #858878 #292d26 #292d26 #858878; background: #3c4036; }
.pause-menu { margin-top: .75rem; padding: .8rem; border: 2px solid; border-color: #a4a894 #292d26 #292d26 #a4a894; background: #343e31; }
.pause-menu h2 { margin: 0; font-size: 1.1rem; }.pause-menu p { margin: .3rem 0 .7rem; color: #d9dfd0; }
.pause-actions { display: flex; flex-wrap: wrap; gap: .5rem; align-items: stretch; }
.pause-link { display: inline-flex; align-items: center; min-height: 44px; box-sizing: border-box; padding: .55rem .8rem; border: 2px solid; border-color: #a4a894 #292d26 #292d26 #a4a894; border-radius: 2px; color: #f9f9ea; background: #4a4d41; text-decoration: none; }
.pause-link:hover { background: #5c6050; }.pause-link:focus-visible { outline: 2px solid #c4f79e; outline-offset: 2px; }
.fullscreen-status { color: #d9dfd0; font-size: .85rem; }
.speed { display: flex; align-items: center; gap: .4rem; }
.time { margin-left: auto; padding: .3rem .45rem; color: #d8f6bd; background: #20291e; font-family: monospace; font-variant-numeric: tabular-nums; }
.skill-section { margin-top: .75rem; padding: .45rem; border: 2px solid; border-color: #858878 #292d26 #292d26 #858878; background: #3c4036; }
.skill-grid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: .4rem; }
.skill-button { display: flex; flex-direction: column; align-items: center; gap: .15rem; padding: .4rem .15rem; min-width: 0; font-size: .8rem; }
.skill-button strong { font-family: monospace; font-size: 1rem; }
.skill-button.selected { color: #152514; background: #b0df8e; border-color: #e0f8c9 #527a43 #527a43 #e0f8c9; box-shadow: inset 0 0 0 1px #527a43; }
button.skill-button.selected:hover:not(:disabled) { background: #c4eca7; }
.release-controls span { margin-right: .2rem; }
.hints { margin-top: 1rem; color: #d9dfd0; }.hints button + button { margin-left: .5rem; }.hints ol { padding-left: 1.5rem; line-height: 1.6; }
.level-navigation { justify-content: space-between; margin-bottom: 1rem; }
@media (max-width: 600px) { .game-page { padding: .6rem; } .game-header { gap: .5rem; } .skill-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } .skill-button { min-height: 48px; } }
</style>
