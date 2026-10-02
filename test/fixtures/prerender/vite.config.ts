import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

// `NEGOTIATE_LIB` swaps the library under test, so the same app can be built against the source
// or against the packaged output. `NEGOTIATE_OUT` keeps those builds from sharing `.svelte-kit`.
const lib =
	process.env.NEGOTIATE_LIB ?? fileURLToPath(new URL('../../../src/lib/index.ts', import.meta.url));

export default defineConfig({
	resolve: {
		alias: { 'negotiate-under-test': lib }
	},
	plugins: [
		sveltekit({
			outDir: process.env.NEGOTIATE_OUT ?? '.svelte-kit',
			// Prerendering runs before (and independently of) the adapter, so a no-op one is enough.
			adapter: { name: 'noop', adapt() {} },
			prerender: { entries: ['/post', '/post.md', '/post.json', '/rendered'] }
		})
	]
});
