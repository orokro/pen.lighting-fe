/*
	index.js
	--------

	Set up our routes
*/

import { createRouter, createWebHistory } from 'vue-router'

// Lazy-loaded placeholders
const HomeView = () => import('../views/HomeView.vue');
const CreateRoomView = () => import('../views/CreateRoomView.vue');
const EditRoomView = () => import('../views/EditRoomView.vue');
const ObsView = () => import('../views/ObsView.vue');
const RoomView = () => import('../views/RoomView.vue');
const AboutView = () => import('../views/AboutView.vue');
const HelpView = () => import('../views/HelpView.vue');

const routes = [
	{ path: '/', name: 'home', component: HomeView },
	{ path: '/create', name: 'create', component: CreateRoomView },
	{ path: '/edit/:room_code', name: 'edit', component: EditRoomView, props: true },
	{ path: '/obs/:room_code', name: 'obs', component: ObsView, props: true, meta: { noTheme: true } },
	{ path: '/room/:room_code', name: 'room', component: RoomView, props: true, meta: { noTheme: true } },
	{ path: '/about', name: 'about', component: AboutView },
	{ path: '/help', name: 'help', component: HelpView },
	{ path: '/:pathMatch(.*)*', redirect: { name: 'home' } } // catch-all
];

const router = createRouter({
	history: createWebHistory(),
	routes
});

export default router;
