import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// Builds a small SvelteKit app that prerenders `/post` alongside its `.md` and `.json` variants,
// guarding the library's reliance on Kit's prerender data-path handling (`add_data_suffix`).
const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = path.join(root, 'test/fixtures/prerender');
const pages = path.join(fixture, '.svelte-kit/output/prerendered/pages');

describe('prerendering', () => {
	beforeAll(() => {
		rmSync(path.join(fixture, '.svelte-kit'), { recursive: true, force: true });
		execFileSync(path.join(root, 'node_modules/.bin/vite'), ['build'], {
			cwd: fixture,
			stdio: 'pipe'
		});
	}, 120_000);

	it('writes the HTML page without a negotiated payload', () => {
		const html = readFileSync(path.join(pages, 'post.html'), 'utf8');
		expect(html).toContain('<h1>Hello</h1>');
		expect(html).not.toContain('id="__negotiate"');
	});

	it('writes the markdown variant as a file', () => {
		expect(statSync(path.join(pages, 'post.md')).isFile()).toBe(true);
		expect(readFileSync(path.join(pages, 'post.md'), 'utf8')).toBe(
			'---\ntitle: Hello\n---\n\n# Hello\n'
		);
	});

	it('writes the JSON variant as a file', () => {
		expect(statSync(path.join(pages, 'post.json')).isFile()).toBe(true);
		expect(JSON.parse(readFileSync(path.join(pages, 'post.json'), 'utf8'))).toEqual({
			title: 'Hello',
			ok: true
		});
	});

	it('does not write data files under the extension paths', () => {
		// Without the pathname normalisation in `handle`, Kit would derive `/post.md/__data.json`,
		// whose directory collides with the `post.md` file above.
		const prerendered = path.join(fixture, '.svelte-kit/output/prerendered');
		for (const dir of ['pages', 'dependencies', 'data']) {
			expect(existsSync(path.join(prerendered, dir, 'post.md/__data.json'))).toBe(false);
			expect(existsSync(path.join(prerendered, dir, 'post.json/__data.json'))).toBe(false);
		}
	});
});
