<template>
  <main class="game-page">
    <header class="game-header" :inert="fullscreenActive">
      <router-link class="back-link" to="/">← Levels</router-link>
      <div>
        <p class="eyebrow">{{ groupName }} · Level {{ levelIndex + 1 }}</p>
        <h1>{{ title }}</h1>
        <p v-if="level && !loading && !error" class="objective">
          <template v-if="playing || finished">Saved {{ savedCount }} · </template>
          Save at least {{ level.needCount }} of {{ level.releaseCount }} lemmings
          <template v-if="!playing && !finished"> · {{ level.timeLimit }} {{ level.timeLimit === 1 ? 'minute' : 'minutes' }}</template>
        </p>
      </div>
      <button class="quiet" type="button" :aria-pressed="musicEnabled" @click="toggleMusic">
        Music {{ musicEnabled ? 'on' : 'off' }}
      </button>
      <button class="quiet" type="button" :aria-pressed="soundEnabled" @click="toggleSound">
        Sound {{ soundEnabled ? 'on' : 'off' }}
      </button>
    </header>

    <section ref="gameScreen" class="game-screen" :class="{ 'is-fullscreen': fullscreenActive }" aria-label="Game screen">
    <div v-if="error" class="notice error" role="alert">{{ error }}</div>
    <p v-else-if="loading" class="notice" role="status">Getting the level ready…</p>
    <p v-else-if="resultMessage" class="notice" role="status">{{ resultMessage }}</p>
    <p v-else class="hint">Tap a skill, then tap a lemming. Drag the level to look around.</p>
    <p v-if="saveWarning" class="notice error" role="status">{{ saveWarning }}</p>
    <p v-if="graphicsError" class="notice error" role="status">{{ graphicsError }}</p>

    <div class="canvas-frame">
      <canvas ref="gameCanvas" width="800" height="480" tabindex="0" aria-label="Lemmings level. Drag to move the view." aria-describedby="keyboard-instructions" @pointerdown.capture="beginCanvasGesture" @pointerup.capture="finishCanvasGesture" @pointercancel.capture="cancelCanvasGesture" @lostpointercapture="loseCanvasCapture" @click.capture="finishCanvasGestureFromClick">
        Your browser does not support the game canvas.
      </canvas>
    </div>
    <p id="keyboard-instructions" class="visually-hidden">Use left and right arrows to choose a lemming, Enter to assign the selected skill, and Space to pause.</p>
    <p class="visually-hidden" role="status" aria-live="polite">{{ keyboardMessage }}</p>

    <button v-if="fullscreenActive && playing && !paused" class="visually-hidden fullscreen-a11y-pause" type="button" aria-controls="pause-menu" @click="openPauseMenu">Pause game</button>
    <div id="game-controls" class="game-controls" :class="{ 'controls-open': fullscreenControlsOpen }">
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
    <div class="game-toolbar" aria-label="Level controls">
      <button v-if="!playing && !finished" ref="startControl" class="primary" type="button" :disabled="!canPlay" @click="start">Start level</button>
      <button v-else-if="playing && !paused" ref="pauseControl" class="primary" type="button" aria-controls="pause-menu" :aria-expanded="paused" @click="openPauseMenu">Pause</button>
      <button v-if="finished && levelSucceeded && nextLevelAvailable" class="primary" type="button" @click="changeLevel(1)">Next level</button>
      <button v-if="finished" :class="{ primary: !levelSucceeded }" type="button" @click="loadLevel">Try again</button>
      <button type="button" :disabled="loading || !level" @click="loadLevel">Restart</button>
      <button class="zoom-button" type="button" aria-label="Zoom out" @click="zoom(-1)">−</button>
      <button class="zoom-button" type="button" aria-label="Zoom in" @click="zoom(1)">+</button>
      <button type="button" :disabled="!zoomChanged" @click="resetZoom">Reset zoom</button>
      <button v-if="!paused" ref="fullscreenEnterButton" type="button" :aria-pressed="fullscreenActive" @click="toggleFullscreen">{{ fullscreenActive ? 'Exit fullscreen' : 'Fullscreen' }}</button>
      <button v-if="fullscreenActive" type="button" :aria-pressed="musicEnabled" @click="toggleMusic">Music {{ musicEnabled ? 'on' : 'off' }}</button>
      <button v-if="fullscreenActive" type="button" :aria-pressed="soundEnabled" @click="toggleSound">Sound {{ soundEnabled ? 'on' : 'off' }}</button>
      <label class="speed">Speed
        <select :value="speed" @change="onSpeedChange">
          <option :value="1">1×</option><option :value="2">2×</option><option :value="4">4×</option>
        </select>
      </label>
      <span v-if="playing || finished" class="time">{{ gameTime }}</span>
    </div>

    <p v-if="fullscreenMode === 'expanded'" class="fullscreen-status" role="status">Expanded view (browser fullscreen unavailable)</p>

    <details class="display-settings" @toggle="onDisplaySettingsToggle">
      <summary>Display settings</summary>
      <fieldset :key="graphicsError">
        <legend>Graphics style</legend>
        <label><input type="radio" name="graphics-mode" value="original" :checked="graphicsMode === 'original'" @change="setGraphicsMode('original')"> Original</label>
        <label><input type="radio" name="graphics-mode" value="enhanced" :checked="graphicsMode === 'enhanced'" @change="setGraphicsMode('enhanced')"> Enhanced</label>
      </fieldset>
      <p>Graphics affect appearance only. Level rules and physics stay the same. This device-specific setting is not included in progress backups.</p>
      <p>Enhanced graphics and live comparison are experimental and may slow play, especially at high speed or on phones.</p>
      <button type="button" :disabled="!canPlay && !comparingGraphics" :aria-expanded="comparingGraphics" aria-controls="graphics-comparison" @click="toggleGraphicsComparison">{{ comparingGraphics ? 'Close comparison' : 'Compare styles' }}</button>
      <section v-if="comparingGraphics" id="graphics-comparison" aria-label="Graphics comparison">
        <p>Both previews show the same moment and view. Scroll sideways on a small screen. Play using the main game above.</p>
        <div class="comparison-grid" role="region" aria-label="Scrollable graphics previews" tabindex="0" data-game-shortcuts-ignore>
          <figure><figcaption>Original</figcaption><canvas ref="originalPreview" width="800" height="480" aria-hidden="true"></canvas></figure>
          <figure><figcaption>Enhanced</figcaption><canvas ref="enhancedPreview" width="800" height="480" aria-hidden="true"></canvas></figure>
        </div>
      </section>
    </details>

    <section v-if="playing || finished" class="skill-section" aria-label="Lemming skills">
      <div class="skill-grid">
        <button v-for="skill in skillButtons" :key="skill.type" type="button" class="skill-button"
          :class="{ selected: selectedSkill === skill.type }" :aria-pressed="selectedSkill === skill.type"
          :disabled="finished || !skillCounts[skill.type]" @click="selectSkill(skill.type)">
          <span>{{ skill.name }}</span><strong>{{ skillCounts[skill.type] ?? 0 }}</strong>
        </button>
      </div>
      <div class="release-controls">
        <span>Release rate: {{ releaseRate }}</span>
        <button type="button" aria-label="Decrease release rate" :disabled="finished" @click="changeReleaseRate(-1)">−</button>
        <button type="button" aria-label="Increase release rate" :disabled="finished" @click="changeReleaseRate(1)">+</button>
        <button type="button" :disabled="finished || nukeExecuted" @click="confirmNuke">{{ nukeArmed ? 'Confirm nuke' : 'Nuke' }}</button>
        <button v-if="nukeArmed" type="button" @click="nukeArmed = false">Cancel</button>
      </div>
      <p v-if="nukeArmed" class="interaction-notice" role="status">Nuke will bomb all lemmings. Press Confirm nuke to proceed.</p>
      <p class="interaction-notice" role="status" aria-live="polite">{{ assignmentMessage }}</p>
    </section>

    <section v-if="hints.length && !loading && !error" class="hints" aria-label="Hints">
      <button v-if="visibleHintCount < hints.length" type="button" @click="visibleHintCount++">{{ visibleHintCount ? 'Another hint' : 'Show a hint' }}</button>
      <button v-if="visibleHintCount" type="button" @click="hideHints">Hide hints</button>
      <ol v-if="visibleHintCount" aria-live="polite"><li v-for="hint in hints.slice(0, visibleHintCount)" :key="hint">{{ hint }}</li></ol>
      <button v-if="visibleHintCount && !exampleMove" type="button" :disabled="exampleBusy" @click="showExample">{{ exampleBusy ? 'Finding example…' : 'Show example first move' }}</button>
      <button v-if="exampleMove" type="button" @click="clearExample">Hide example</button>
      <p v-if="exampleMove" role="status">Tested example, not live advice: use {{ exampleSkillName }} near the highlighted spot when the timer shows about {{ exampleClock }}.</p>
      <p v-else-if="exampleError" role="status">{{ exampleError }}</p>
    </section>
    <p v-else-if="availableHints.length && !loading && !error && hintCompatibility === 'different'" class="hint">Hints were verified for a different DOS data set. You can still play this level.</p>
    <p v-else-if="availableHints.length && !loading && !error && hintCompatibility === 'unavailable'" class="hint">Hint compatibility could not be checked. You can still play this level.</p>
    </div>
    </section>

    <nav class="level-navigation" aria-label="Level navigation" :inert="fullscreenActive">
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
.objective { color: #e1f3d2; margin: .4rem 0; font-weight: 600; }
.interaction-notice { color: #f9e3b3; margin: .4rem .2rem 0; }
.interaction-notice:empty { display: none; }
.error { color: #ffd3b8; }
.canvas-frame { background: #000; border: 4px solid; border-color: #999a87 #34382f #34382f #999a87; overflow: hidden; }
canvas { display: block; width: 100%; height: auto; aspect-ratio: 5 / 3; image-rendering: pixelated; touch-action: none; }
button, select { min-height: 44px; padding: .55rem .8rem; border-radius: 2px; border: 2px solid; border-color: #a4a894 #292d26 #292d26 #a4a894; color: #f9f9ea; background: #4a4d41; font: inherit; cursor: pointer; }
button:hover:not(:disabled) { background: #5c6050; }
button:focus-visible, select:focus-visible { outline: 2px solid #c4f79e; outline-offset: 2px; }
canvas:focus-visible { outline: 2px solid #c4f79e; outline-offset: -3px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.fullscreen-a11y-pause:focus-visible { position: absolute; top: .5rem; left: .5rem; z-index: 3; width: auto; height: auto; margin: 0; padding: .55rem .8rem; clip: auto; overflow: visible; border: 2px solid; }
button:disabled { cursor: default; opacity: .45; }
button.zoom-button { min-width: 44px; box-sizing: border-box; }
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
.display-settings { margin-top: .75rem; padding: .6rem; border: 2px solid; border-color: #858878 #292d26 #292d26 #858878; background: #3c4036; }
.display-settings summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 600; }
.display-settings summary::before { content: '▸'; margin-right: .5rem; }.display-settings[open] summary::before { content: '▾'; }
.display-settings summary:focus-visible, .display-settings input:focus-visible { outline: 2px solid #c4f79e; outline-offset: 2px; }
.display-settings fieldset { display: flex; flex-wrap: wrap; gap: .5rem; border: 0; margin: .3rem 0; padding: 0; }
.display-settings legend { padding: 0; font-weight: 600; }
.display-settings label { display: inline-flex; align-items: center; gap: .45rem; min-height: 44px; padding: 0 .5rem; }
.display-settings input { width: 1.1rem; height: 1.1rem; accent-color: #b0df8e; }
.display-settings p { margin: .4rem 0 .6rem; color: #d9dfd0; }
.comparison-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; overflow-x: auto; }
.comparison-grid:focus-visible { outline: 2px solid #c4f79e; outline-offset: 2px; }
.comparison-grid figure { margin: 0; min-width: 0; }.comparison-grid figcaption { margin-bottom: .3rem; font-weight: 600; }
.comparison-grid canvas { background: #000; border: 2px solid #858878; box-sizing: border-box; touch-action: auto; }
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
@media (max-width: 600px) {
  .game-page { padding: .6rem; }
  .game-header { gap: .5rem; flex-wrap: wrap; }
  .game-header > div { flex-basis: calc(100% - 90px); }
  .skill-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .skill-button { min-height: 48px; }
  .comparison-grid { grid-template-columns: repeat(2, minmax(260px, 1fr)); }
}
</style>
