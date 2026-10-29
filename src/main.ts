import { createApp } from 'vue'
import App from './app.vue'
import router from './router'
import { prepareOfflineApp } from './offline-readiness'

createApp(App).use(router).mount('#app')

window.addEventListener('load', () => {
  const workers = import.meta.env.PROD && 'serviceWorker' in navigator ? navigator.serviceWorker : undefined;
  void prepareOfflineApp(workers, `${import.meta.env.BASE_URL}sw.js`);
});
