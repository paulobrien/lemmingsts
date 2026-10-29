import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import MainView from '@/views/main-view.vue';
import GameView from '@/views/game-view.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'main',
    component: MainView
  },
  {
    path: '/game/:gameType',
    name: 'game',
    component: GameView
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'main' }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
