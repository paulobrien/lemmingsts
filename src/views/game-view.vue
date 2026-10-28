<template>
  <main class="game-page">
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
      <button v-else-if="playing" class="primary" type="button" @click="togglePause">{{ paused ? 'Resume' : 'Pause' }}</button>
      <button v-if="finished" class="primary" type="button" @click="loadLevel">Try again</button>
      <button type="button" :disabled="loading || !level" @click="loadLevel">Restart</button>
      <button type="button" aria-label="Zoom out" @click="zoom(-1)">−</button>
      <button type="button" aria-label="Zoom in" @click="zoom(1)">+</button>
      <label class="speed">Speed
        <select :value="speed" @change="onSpeedChange">
          <option :value="1">1×</option><option :value="2">2×</option><option :value="4">4×</option>
        </select>
      </label>
      <span v-if="playing || finished" class="time">{{ gameTime }}</span>
    </div>

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
.game-page { max-width: 1080px; min-height: 100vh; box-sizing: border-box; padding: 1rem; margin: 0 auto; color: #edf7f1; background: #10251d; text-align: left; }
.game-header { display: flex; align-items: center; gap: 1rem; margin-bottom: .75rem; }
.game-header > div { flex: 1; min-width: 0; }
h1 { font-size: clamp(1.2rem, 3vw, 2rem); margin: .1rem 0; line-height: 1.15; }
.eyebrow { color: #8de8b4; text-transform: uppercase; font-size: .7rem; letter-spacing: .12em; margin: 0; font-weight: bold; }
.back-link { color: #b4f3cf; white-space: nowrap; }
.hint, .notice { color: #c5d9cc; min-height: 1.4rem; margin: .5rem 0; }
.error { color: #ffd3b8; }
.canvas-frame { background: #000; border: 1px solid #345547; border-radius: .65rem; overflow: hidden; }
canvas { display: block; width: 100%; height: auto; aspect-ratio: 5 / 3; image-rendering: pixelated; touch-action: none; }
button, select { min-height: 44px; padding: .55rem .8rem; border-radius: .5rem; border: 1px solid #537464; color: #f4fff8; background: #213c32; font: inherit; cursor: pointer; }
button:hover:not(:disabled), button:focus-visible, select:focus-visible { border-color: #a2f4bd; outline-color: #a2f4bd; }
button:disabled { cursor: default; opacity: .45; }
button.primary { background: #85ed9d; color: #102b1c; border-color: #85ed9d; font-weight: bold; }
button.quiet { background: transparent; }
.game-toolbar, .release-controls, .level-navigation { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin-top: .75rem; }
.speed { display: flex; align-items: center; gap: .4rem; }
.time { margin-left: auto; font-variant-numeric: tabular-nums; }
.skill-section { margin-top: .75rem; }
.skill-grid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: .4rem; }
.skill-button { display: flex; flex-direction: column; align-items: center; gap: .15rem; padding: .4rem .15rem; min-width: 0; font-size: .8rem; }
.skill-button strong { font-size: 1rem; }
.skill-button.selected { background: #426a4e; border-color: #a2f4bd; box-shadow: inset 0 0 0 1px #a2f4bd; }
.release-controls span { margin-right: .2rem; }
.hints { margin-top: 1rem; color: #c5d9cc; }.hints button + button { margin-left: .5rem; }.hints ol { padding-left: 1.5rem; line-height: 1.6; }
.level-navigation { justify-content: space-between; margin-bottom: 1rem; }
@media (max-width: 600px) { .game-page { padding: .6rem; } .game-header { gap: .5rem; } .skill-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } .skill-button { min-height: 48px; } }
</style>
