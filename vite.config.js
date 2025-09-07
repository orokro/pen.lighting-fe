import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'   // 👈 add this

// https://vite.dev/config/
export default defineConfig({
	plugins: [vue()],

	// add the @composables alias
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'@composables': '/src/composables',
			'@views': '/src/views',
			'@router': '/src/router',
			'@assets': '/src/assets',
			'@styles': '/src/styles',
			'@components': '/src/components',
		}
	}
});
