<template>
  <router-view />
</template>

<style>
* { box-sizing: border-box; }
#app {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  padding: 0px 0px 0px 0px;
  margin: 0px 0px 0px 0px;
}

button, a { -webkit-tap-highlight-color: transparent; }
:focus-visible { outline: 3px solid #d99739; outline-offset: 3px; }

html, body, #app {
    padding: 0px;
    margin: 0px;
}

</style>
