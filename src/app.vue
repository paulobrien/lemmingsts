<template>
  <router-view />
</template>

<style>
/* Hallmark · checked: 2026-10-29 · genre: playful · scope: app · built: the project · redesign: polish · v2.0.0 */
* { box-sizing: border-box; }
html, body { overflow-x: clip; }
html, body, #app { padding: 0; margin: 0; min-height: 100%; }
body { color: var(--color-ink); background: var(--color-ground); font-family: var(--font-body); line-height: 1.5; color-scheme: dark; caret-color: var(--color-accent); scrollbar-color: var(--color-edge) var(--color-ground); }
button, a { -webkit-tap-highlight-color: var(--color-clear); }
:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px; }
::selection { color: var(--color-accent-ink); background: var(--color-accent); }
h1, h2 { overflow-wrap: break-word; min-width: 0; text-wrap: balance; }
</style>
