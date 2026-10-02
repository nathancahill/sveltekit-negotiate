import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// Builds a small SvelteKit app that prerenders `/post` alongside its `.md` and `.json` variants,
// guarding the library's reliance on Kit's prerender data-path handling (`add_data_suffix`).
//
// The app is built twice: once against `src/lib`, and once against the output of `svelte-package`.
// The second build is what users install. 0.3.0 passed every source-level test while shipping a
// component that `svelte-package` had rewritten (it stripped `type="text/plain"` from the payload
// tag), so every negotiated request returned 406.
const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = path.join(root, 'test/fixtures/prerender');
const packaged = path.join(fixture, '.packaged');

type Target = { name: string; outDir: string; lib?: () => string };

const targets: Target[] = [
	{ name: 'source', outDir: '.svelte-kit' },
	{
		name: 'packaged',
		outDir: '.svelte-kit-packaged',
		// Package fresh rather than reading `dist/`, which is gitignored and may be stale. The
		// output lives inside the fixture so its imports (`svelte`, `$app/state`) resolve.
		// `NEGOTIATE_PACKAGED` points at an existing build instead, e.g. a published tarball's dist.
		lib: () => {
			if (process.env.NEGOTIATE_PACKAGED) return process.env.NEGOTIATE_PACKAGED;
			execFileSync(path.join(root, 'node_modules/.bin/svelte-package'), ['-o', packaged], {
				cwd: root,
				stdio: 'pipe'
			});
			return path.join(packaged, 'index.js');
		}
	}
];

describe.each(targets)('prerendering against $name', ({ outDir, lib }) => {
	const output = path.join(fixture, outDir, 'output/prerendered');
	const pages = path.join(output, 'pages');

	beforeAll(() => {
		rmSync(path.join(fixture, outDir), { recursive: true, force: true });
		const env: NodeJS.ProcessEnv = { ...process.env, NEGOTIATE_OUT: outDir };
		if (lib) env.NEGOTIATE_LIB = lib();
		execFileSync(path.join(root, 'node_modules/.bin/vite'), ['build'], {
			cwd: fixture,
			env,
			stdio: 'pipe'
		});
	}, 120_000);

	it('writes the HTML page without a negotiated payload', () => {
		const html = readFileSync(path.join(pages, 'post.html'), 'utf8');
		expect(html).toContain('<h1>Hello</h1>');
		expect(html).not.toContain('id="__negotiate"');
	});

	it('renders the payload as a non-executable, escaped script tag', () => {
		const html = readFileSync(path.join(pages, 'rendered.html'), 'utf8');
		expect(html).toContain(
			'<script type="text/plain" id="__negotiate">before <\\/script> after</script>'
		);
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
		for (const dir of ['pages', 'dependencies', 'data']) {
			expect(existsSync(path.join(output, dir, 'post.md/__data.json'))).toBe(false);
			expect(existsSync(path.join(output, dir, 'post.json/__data.json'))).toBe(false);
		}
	});
});
