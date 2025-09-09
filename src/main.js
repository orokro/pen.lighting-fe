/*
	main.js
	-------

	Kick off for the Vue app.
*/

// vue & app
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// styles
import './style.scss'
import 'material-icons/iconfont/material-icons.css';

// load middle-ware & kick off app
createApp(App).use(router).mount('#app')
