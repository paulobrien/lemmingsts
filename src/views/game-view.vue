<template>
  <main class="game-page" :class="{ 'windows-mode': gameMode === 'windows' }">
    <header class="game-header" :inert="fullscreenActive">
      <div class="level-heading">
        <p class="level-context">{{ groupName }} <span>Level {{ levelIndex + 1 }}</span></p>
        <h1>{{ title }}</h1>
        <p v-if="level && !loading && !error" class="objective">
          <span v-if="playing || finished" class="saved-count">Saved {{ savedCount }}</span>
          Save at least {{ level.needCount }} of {{ level.releaseCount }} lemmings<template v-if="!playing && !finished">, {{ level.timeLimit }} {{ level.timeLimit === 1 ? 'minute' : 'minutes' }}</template>
        </p>
      </div>
      <div class="audio-controls" :class="{ 'windows-hidden-controls': nativeWindowsPanel && playing && !paused }" role="group" aria-label="Audio settings">
      <button class="quiet" type="button" :disabled="loading" :aria-pressed="musicEnabled" @click="toggleMusic">
        Music {{ musicEnabled ? 'on' : 'off' }}
      </button>
      <button class="quiet" type="button" :aria-pressed="soundEnabled" @click="toggleSound">
        Sound {{ soundEnabled ? 'on' : 'off' }}
      </button>
      </div>
    </header>

    <section ref="gameScreen" class="game-screen" :class="{ 'is-fullscreen': fullscreenActive, 'native-windows-playing': nativeWindowsPanel && playing && !paused }" aria-label="Game screen">
    <div v-if="error" class="notice error" role="alert">{{ error }}</div>
    <p v-else-if="loading" class="notice" role="status">Getting the level ready…</p>
    <p v-else-if="resultMessage" class="notice" role="status">{{ resultMessage }}</p>
    <p v-else class="hint">Tap a skill, then tap a lemming. Drag the level to look around.</p>
    <p v-if="saveWarning" class="notice error" role="status">{{ saveWarning }}</p>
    <p v-if="graphicsError" class="notice error" role="status">{{ graphicsError }}</p>
    <p v-else-if="graphicsNotice" class="notice" role="status">{{ graphicsNotice }}</p>
    <p v-if="gameMode === 'windows' && playing && !nativeWindowsPanel" class="notice" role="status">To use fast-forward on the original Windows panel, reimport your Windows ISO. The controls below remain available.</p>
    <p v-if="nativeWindowsPanel && playing && !paused && nukeArmed" class="native-nuke-notice" role="status" aria-live="assertive">Nuke armed. Press Nuke again to confirm.</p>

    <div class="canvas-frame">
      <canvas ref="gameCanvas" :class="{ 'windows-panel': nativeWindowsPanel }" width="800" height="480" tabindex="0" aria-label="Lemmings level. Drag to move the view." aria-describedby="game-objective keyboard-instructions" @pointerdown.capture="beginCanvasGesture" @pointerup.capture="finishCanvasGesture" @pointercancel.capture="cancelCanvasGesture" @lostpointercapture="loseCanvasCapture" @click.capture="finishCanvasGestureFromClick">
        Your browser does not support the game canvas.
      </canvas>
    </div>
    <p id="game-objective" class="visually-hidden" v-if="level && !loading && !error">Saved {{ savedCount }}. Save at least {{ level.needCount }} of {{ level.releaseCount }} lemmings.</p>
    <p id="keyboard-instructions" class="visually-hidden">Use left and right arrows to choose a lemming, Enter to assign the selected skill, and Space to pause. In Windows mode, use the pause-menu buttons to move the level view.</p>
    <p class="visually-hidden" role="status" aria-live="polite">{{ keyboardMessage }}</p>

    <button v-if="(fullscreenActive || nativeWindowsPanel) && playing && !paused" class="visually-hidden fullscreen-a11y-pause" type="button" aria-controls="pause-menu" @click="openPauseMenu">Pause game</button>
    <div id="game-controls" class="game-controls" :class="{ 'controls-open': fullscreenControlsOpen }">
    <section v-if="playing && paused && !deferFullscreenControls" id="pause-menu" class="pause-menu" role="region" aria-labelledby="pause-menu-heading">
      <h2 id="pause-menu-heading" ref="pauseHeading" tabindex="-1">Paused</h2>
      <p>The game is paused. You can still select skills and inspect the level.</p>
      <p v-if="gameMode === 'windows' && level">Save at least {{ level.needCount }} of {{ level.releaseCount }} lemmings; saved {{ savedCount }}.</p>
      <div class="pause-actions">
        <button class="primary" type="button" @click="resumeFromMenu">Resume</button>
        <button type="button" @click="restartFromMenu">Restart level</button>
        <router-link class="pause-link" to="/">Level selection</router-link>
        <button type="button" :aria-pressed="fullscreenActive" @click="toggleFullscreen">{{ fullscreenActive ? 'Exit fullscreen' : 'Fullscreen' }}</button>
      </div>
      <div v-if="nativeWindowsPanel" class="pause-actions" role="group" aria-label="Move the level view">
        <button type="button" @click="panLevel(-1)">Move view left</button>
        <button type="button" @click="panLevel(1)">Move view right</button>
      </div>
      <div v-if="gameMode === 'windows'" class="pause-actions">
        <button type="button" :aria-pressed="windowsIconAnimationsEnabled" @click="toggleWindowsIconAnimations">Button animations {{ windowsIconAnimationsEnabled ? 'on' : 'off' }}</button>
      </div>
    </section>
    <div class="game-toolbar" :class="{ 'windows-hidden-controls': nativeWindowsPanel && playing && !paused }" aria-label="Level controls">
      <button v-if="!playing && !finished" ref="startControl" class="primary" type="button" :disabled="!canPlay" @click="start">Start level</button>
      <button v-else-if="playing && !paused" ref="pauseControl" class="primary" type="button" aria-controls="pause-menu" :aria-expanded="paused" @click="openPauseMenu">Pause</button>
      <button v-if="finished && levelSucceeded && nextLevelAvailable" class="primary" type="button" @click="changeLevel(1)">Next level</button>
      <button v-if="finished" :class="{ primary: !levelSucceeded }" type="button" @click="loadLevel">Try again</button>
      <button v-if="playing && !paused" type="button" :disabled="loading || !level" @click="loadLevel">Restart</button>
      <button class="zoom-button" type="button" aria-label="Zoom out" @click="zoom(-1)">−</button>
      <button class="zoom-button" type="button" aria-label="Zoom in" @click="zoom(1)">+</button>
      <button type="button" :disabled="!zoomChanged" @click="resetZoom">Reset zoom</button>
      <button v-if="!paused" ref="fullscreenEnterButton" type="button" :aria-pressed="fullscreenActive" @click="toggleFullscreen">{{ fullscreenActive ? 'Exit fullscreen' : 'Fullscreen' }}</button>
      <button v-if="fullscreenActive" type="button" :disabled="loading" :aria-pressed="musicEnabled" @click="toggleMusic">Music {{ musicEnabled ? 'on' : 'off' }}</button>
      <button v-if="fullscreenActive" type="button" :aria-pressed="soundEnabled" @click="toggleSound">Sound {{ soundEnabled ? 'on' : 'off' }}</button>
      <label class="speed">Speed
        <select :value="speed" @change="onSpeedChange">
          <option :value="1">1×</option><option :value="2">2×</option><option :value="4">4×</option>
        </select>
      </label>
      <span v-if="playing || finished" class="time">{{ gameTime }}</span>
    </div>

    <p v-if="fullscreenMode === 'expanded'" class="fullscreen-status" role="status">Expanded view (browser fullscreen unavailable)</p>

    <section v-if="playing || finished" class="skill-section" :class="{ 'windows-hidden-controls': nativeWindowsPanel && playing && !paused }" aria-label="Lemming skills">
      <div class="skill-grid">
        <button v-for="(skill, index) in skillButtons" :key="skill.type" type="button" class="skill-button"
          :class="{ selected: selectedSkill === skill.type }" :aria-pressed="selectedSkill === skill.type"
          :disabled="finished || !skillCounts[skill.type]" @click="selectSkill(skill.type)">
          <img v-if="gameMode === 'windows' && windowsSkillIcons[index]" class="windows-skill-icon" :src="windowsSkillIcons[index]" alt="" aria-hidden="true">
          <span>{{ skill.name }}</span><strong>{{ skillCounts[skill.type] ?? 0 }}</strong>
        </button>
      </div>
      <div class="release-controls">
        <span>Release rate: {{ releaseRate }}</span>
        <button type="button" aria-label="Decrease release rate" :disabled="finished" @click="changeReleaseRate(-1)">−</button>
        <button type="button" aria-label="Increase release rate" :disabled="finished" @click="changeReleaseRate(1)">+</button>
        <button type="button" :disabled="finished || nukeExecuted" @click="confirmNuke">{{ nukeArmed ? 'Confirm nuke' : 'Nuke' }}</button>
        <button v-if="nukeArmed" type="button" @click="cancelNuke">Cancel</button>
      </div>
      <p v-if="nukeArmed" class="interaction-notice" role="status">Nuke will bomb all lemmings. Press Confirm nuke to proceed.</p>
      <p class="interaction-notice" role="status" aria-live="polite">{{ assignmentMessage }}</p>
    </section>

    <section v-if="hints.length && !loading && !error" class="hints" :class="{ 'windows-hidden-controls': nativeWindowsPanel && playing && !paused }" aria-label="Hints">
      <button v-if="visibleHintCount < hints.length" type="button" @click="visibleHintCount++">{{ visibleHintCount ? 'Another hint' : 'Show a hint' }}</button>
      <button v-if="visibleHintCount" type="button" @click="hideHints">Hide hints</button>
      <ol v-if="visibleHintCount" aria-live="polite"><li v-for="hint in hints.slice(0, visibleHintCount)" :key="hint">{{ hint }}</li></ol>
      <button v-if="visibleHintCount && !exampleMove" type="button" :disabled="exampleBusy" @click="showExample">{{ exampleBusy ? 'Finding example…' : 'Show example first move' }}</button>
      <button v-if="exampleMove" type="button" @click="clearExample">Hide example</button>
      <p v-if="exampleMove" role="status">Tested example, not live advice: use {{ exampleSkillName }} near the highlighted spot when the timer shows about {{ exampleClock }}.</p>
      <p v-else-if="exampleError" role="status">{{ exampleError }}</p>
    </section>
    <p v-else-if="availableHints.length && !loading && !error && hintCompatibility === 'different'" class="hint">Hints were verified for a different {{ gameMode === 'windows' ? 'Windows' : 'DOS' }} data set. You can still play this level.</p>
    <p v-else-if="availableHints.length && !loading && !error && hintCompatibility === 'unavailable'" class="hint">Hint compatibility could not be checked. You can still play this level.</p>
    </div>
    </section>

    <nav v-if="!playing" class="level-navigation" aria-label="Level navigation" :inert="fullscreenActive">
      <router-link class="pause-link level-selection" to="/">Level selection</router-link>
      <button type="button" :disabled="loading" @click="changeLevel(-1)">Previous level</button>
      <button type="button" :disabled="loading" @click="changeLevel(1)">Next level</button>
    </nav>
  </main>
</template>

<script lang="ts" src="./game-view.ts"></script>

<style scoped>
/* Hallmark · checked: 2026-10-29 · genre: playful · scope: app · built: the project · redesign: polish · v2.0.0 */
/* User-directed: remove the header back link, preserve pause navigation and the original game canvas. */
.game-page { max-width: var(--content-width); min-height: 100vh; box-sizing: border-box; padding: 1.5rem 2rem; margin: 0 auto; color: var(--color-ink); background: var(--color-surface); text-align: left; }
.game-header { display: flex; align-items: center; gap: 1rem; margin-bottom: .75rem; }
.level-heading { flex: 1; min-width: 0; }
.audio-controls { display: flex; flex-wrap: wrap; gap: .5rem; }
h1 { font-size: 1.5rem; overflow-wrap: break-word; min-width: 0; text-wrap: balance; margin: .1rem 0; line-height: 1.15; }
.level-context { display: flex; align-items: center; gap: .75rem; color: var(--color-muted); font-size: .8rem; margin: 0 0 .3rem; }
.level-context span { padding-left: .75rem; border-left: 1px solid var(--color-edge); }
.saved-count { color: var(--color-accent); margin-right: 1rem; }

.hint, .notice { color: var(--color-muted); min-height: 1.4rem; margin: .5rem 0; }
.objective { color: var(--color-muted); margin: .4rem 0; font-weight: 600; }
.interaction-notice { color: var(--color-warning); margin: .4rem .2rem 0; }
.interaction-notice:empty { display: none; }
.game-screen { position: relative; }
.native-nuke-notice { position: absolute; z-index: 3; top: .5rem; right: .5rem; margin: 0; padding: .35rem .55rem; color: var(--color-ink); background: var(--color-surface); pointer-events: none; }
.error { color: var(--color-error); }
.canvas-frame { background: var(--color-black); border: 4px solid; border-color: var(--color-edge-light) var(--color-edge-dark) var(--color-edge-dark) var(--color-edge-light); overflow: hidden; }
canvas { display: block; width: 100%; height: auto; aspect-ratio: 5 / 3; image-rendering: pixelated; touch-action: none; }
canvas.windows-panel { aspect-ratio: 24 / 11; }
button, select { min-height: 44px; padding: .55rem .8rem; border-radius: 2px; border: 2px solid; border-color: var(--color-edge-light) var(--color-edge-dark) var(--color-edge-dark) var(--color-edge-light); color: var(--color-ink); background: var(--color-panel-raised); font: inherit; cursor: pointer; }
button:hover:not(:disabled) { background: var(--color-panel-raised); box-shadow: inset 0 0 0 1px var(--color-edge-light); }
button:focus-visible, select:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
canvas:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -3px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.windows-mode .windows-hidden-controls:not(:focus-within) { position: absolute; box-sizing: border-box; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.fullscreen-a11y-pause:focus-visible { position: absolute; top: .5rem; left: .5rem; z-index: 3; width: auto; height: auto; margin: 0; padding: .55rem .8rem; clip: auto; overflow: visible; border: 2px solid; }
button:disabled { cursor: not-allowed; opacity: .45; }
button.zoom-button { min-width: 44px; box-sizing: border-box; }
button.primary { background: var(--color-accent); color: var(--color-accent-ink); border-color: var(--color-accent) var(--color-edge-dark) var(--color-edge-dark) var(--color-accent); font-weight: bold; }
button.primary:hover:not(:disabled) { background: var(--color-accent); box-shadow: inset 0 0 0 2px var(--color-accent-ink); }
button.quiet { background: var(--color-clear); }
button.quiet[aria-pressed="true"] { border-color: var(--color-accent); color: var(--color-accent); background: var(--color-surface); }
.game-toolbar, .release-controls, .level-navigation { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin-top: .75rem; padding: .6rem 0; border: 0; border-bottom: 1px solid var(--color-edge-dark); background: var(--color-clear); }
.pause-menu { margin-top: .75rem; padding: .8rem; border: 2px solid; border-color: var(--color-edge-light) var(--color-edge-dark) var(--color-edge-dark) var(--color-edge-light); background: var(--color-panel); }
.pause-menu h2 { margin: 0; font-size: 1.1rem; }.pause-menu p { margin: .3rem 0 .7rem; color: var(--color-muted); }
.pause-actions { display: flex; flex-wrap: wrap; gap: .5rem; align-items: stretch; }
.pause-link { display: inline-flex; align-items: center; min-height: 44px; box-sizing: border-box; padding: .55rem .8rem; border: 2px solid; border-color: var(--color-edge-light) var(--color-edge-dark) var(--color-edge-dark) var(--color-edge-light); border-radius: 2px; color: var(--color-ink); background: var(--color-panel-raised); text-decoration: none; }
.pause-link:hover { background: var(--color-panel-raised); box-shadow: inset 0 0 0 1px var(--color-edge-light); }.pause-link:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
.fullscreen-status { color: var(--color-muted); font-size: .85rem; }
.speed { display: flex; align-items: center; gap: .4rem; }
.time { margin-left: auto; padding: .3rem .45rem; color: var(--color-accent); background: var(--color-edge-dark); font-family: var(--font-body); font-variant-numeric: tabular-nums; }
.skill-section { margin-top: .75rem; padding: .6rem 0; border: 0; border-bottom: 1px solid var(--color-edge-dark); background: var(--color-clear); }
.skill-grid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: .4rem; }
.skill-button { display: flex; flex-direction: column; align-items: center; gap: .15rem; padding: .4rem .15rem; min-width: 0; font-size: .8rem; }
.windows-skill-icon { width: 32px; height: 40px; image-rendering: pixelated; }
.skill-button strong { font-family: var(--font-body); font-size: 1rem; }
.skill-button.selected { color: var(--color-accent-ink); background: var(--color-accent); border-color: var(--color-accent) var(--color-edge-dark) var(--color-edge-dark) var(--color-accent); box-shadow: inset 0 0 0 1px var(--color-edge-dark); }
button.skill-button.selected:hover:not(:disabled) { background: var(--color-accent); box-shadow: inset 0 0 0 2px var(--color-accent-ink); }
.release-controls span { margin-right: .2rem; }
.hints { margin-top: 1rem; color: var(--color-muted); }.hints button + button { margin-left: .5rem; }.hints ol { padding-left: 1.5rem; line-height: 1.6; }
.level-navigation { justify-content: flex-end; margin-bottom: 1rem; }
.level-selection { margin-right: auto; }
button, select, .pause-link { white-space: nowrap; }
button:active:not(:disabled), .pause-link:active { border-color: var(--color-edge-dark) var(--color-edge-light) var(--color-edge-light) var(--color-edge-dark); }
.skill-section { border: 0; padding: 0; background: var(--color-clear); }
.hints { border-top: 1px solid var(--color-edge); padding: 1rem 0 .25rem; line-height: 1.6; }
.game-controls { padding-top: .25rem; }
/* Windows controls echo the original desktop edition while the canvas remains uncluttered. */
.windows-mode .game-toolbar, .windows-mode .skill-section, .windows-mode .pause-menu {
  padding: .6rem; background: #c0c0c0; color: #202020; border: 2px solid;
  border-color: #eeeeee #555555 #555555 #eeeeee;
}
.windows-mode .release-controls { border-color: #858585; }
.windows-mode .game-controls button, .windows-mode .game-controls select, .windows-mode .game-controls .pause-link {
  color: #202020; background: #c0c0c0; border-color: #eeeeee #555555 #555555 #eeeeee;
}
.windows-mode .game-controls button:hover:not(:disabled), .windows-mode .game-controls .pause-link:hover { background: #d8d8d8; }
.windows-mode .game-controls button.primary, .windows-mode .game-controls button.skill-button.selected {
  color: #f5f5f5; background: #174b91; border-color: #8cabd5 #18345d #18345d #8cabd5;
}
.windows-mode .game-controls button.primary:hover:not(:disabled), .windows-mode .game-controls button.skill-button.selected:hover:not(:disabled) { background: #245caa; }
.windows-mode .pause-menu p { color: #363636; }
@media (min-width: 900px) {
  /* Keep the canvas and the first control row together on shorter desktop screens. */
  .game-page { max-width: min(var(--content-width), max(50rem, calc((100dvh - 17rem) * 5 / 3 + 4rem))); }
}
@media (min-width: 900px) and (orientation: landscape) and (pointer: coarse) {
  /* Use the tablet width while keeping the level and its controls visible together. */
  .game-page { max-width: none; }
  .game-screen:not(.is-fullscreen) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 14rem;
    column-gap: .75rem;
    align-items: start;
  }
  .game-screen:not(.is-fullscreen) > .hint,
  .game-screen:not(.is-fullscreen) > .notice { grid-column: 1 / -1; }
  .game-screen:not(.is-fullscreen) > .canvas-frame { grid-column: 1; min-width: 0; }
  .game-screen:not(.is-fullscreen) > .game-controls { grid-column: 2; min-width: 0; padding-top: 0; }
  .game-screen.native-windows-playing:not(.is-fullscreen) { grid-template-columns: minmax(0, 1fr); }
  .game-screen.native-windows-playing:not(.is-fullscreen) > .game-controls { grid-column: 1; }
  .game-screen:not(.is-fullscreen) .game-toolbar { margin-top: 0; }
  .game-screen:not(.is-fullscreen) .skill-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 600px) {
  .game-page { padding: 1rem .75rem; }
  h1 { font-size: 1.25rem; }
  .audio-controls { gap: .5rem; }
  .objective { font-size: .85rem; line-height: 1.5; }
  .level-navigation { gap: .5rem; }
  .level-selection { flex-basis: 100%; justify-content: center; }
  .game-header { gap: .5rem; flex-wrap: wrap; }
  .level-heading { flex-basis: 100%; }
  .skill-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .skill-button { min-height: 48px; }
}
</style>
