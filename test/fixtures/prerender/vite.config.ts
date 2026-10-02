import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		sveltekit({
			// Prerendering runs before (and independently of) the adapter, so a no-op one is enough.
			adapter: { name: 'noop', adapt() {} },
			prerender: { entries: ['/post', '/post.md', '/post.json'] }
		})
	]
});
