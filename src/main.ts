import { createApp } from 'vue'
import App from './app.vue'
import router from './router'

createApp(App).use(router).mount('#app')

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.error('Unable to prepare offline play:', error);
    });
  });
}
