import { describe, it, expect } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

import { createNegotiation } from './index.ts';

type EventOpts = {
	pathname?: string;
	accept?: string | null;
};

function mockEvent({ pathname = '/', accept }: EventOpts = {}): RequestEvent {
	const headers = new Headers();
	if (accept !== undefined && accept !== null) headers.set('accept', accept);

	return {
		url: new URL(`http://localhost${pathname}`),
		request: new Request(`http://localhost${pathname}`, { headers }),
		locals: {} as App.Locals
	} as unknown as RequestEvent;
}

function htmlWithPayload(payload: string) {
	const escaped = payload.replace(/<\/script/gi, '<\\/script');
	return `<!doctype html><html><head><script type="text/plain" id="__negotiate">${escaped}</script></head><body>hi</body></html>`;
}

const types = {
	'text/markdown': { extension: '.md' },
	'application/json': { extension: '.json' }
} as const;

describe('createNegotiation', () => {
	it('returns the documented surface area', () => {
		const result = createNegotiation(types);
		expect(result).toEqual(
			expect.objectContaining({
				handle: expect.any(Function),
				reroute: expect.any(Function),
				negotiate: expect.any(Function),
				Negotiate: expect.anything()
			})
		);
	});
});

describe('reroute', () => {
	const { reroute } = createNegotiation(types);

	it('strips a registered extension from the pathname', () => {
		expect(reroute('/posts/hello.md')).toBe('/posts/hello');
	});

	it('normalises a bare extension at the root to /', () => {
		expect(reroute('/.json')).toBe('/');
	});

	it('returns the pathname unchanged for paths without a registered extension', () => {
		expect(reroute('/about')).toBe('/about');
	});

	it('leaves unknown extensions alone', () => {
		expect(reroute('/feed.xml')).toBe('/feed.xml');
	});

	it('composes with other pathname transforms', () => {
		const stripLocale = (url: string) => url.replace(/^\/(en|fr)(?=\/|$)/, '') || '/';
		expect(stripLocale(reroute('/en/posts/hello.md'))).toBe('/posts/hello');
		expect(stripLocale(reroute('/fr/about'))).toBe('/about');
	});
});

describe('handle – type selection', () => {
	const { handle } = createNegotiation(types);

	it('selects the matching mime from the Accept header', async () => {
		const event = mockEvent({ accept: 'application/json' });
		const resolve = async () =>
			new Response(htmlWithPayload('{"ok":true}'), {
				headers: { 'content-type': 'text/html; charset=utf-8' }
			});

		const response = await handle({ event, resolve } as never);
		expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
		expect(response.headers.get('vary')).toBe('accept');
		await expect(response.text()).resolves.toBe('{"ok":true}');
	});

	it('exposes the negotiated mime on locals', async () => {
		const event = mockEvent({ accept: 'application/json' });
		const resolve = async () =>
			new Response(htmlWithPayload('{}'), { headers: { 'content-type': 'text/html' } });

		await handle({ event, resolve } as never);
		expect((event.locals as { negotiate?: string }).negotiate).toBe('application/json');
	});

	it('prefers text/html when the client ranks it higher than our types', async () => {
		const event = mockEvent({ accept: 'text/html;q=1.0, application/json;q=0.8' });
		const resolve = async () =>
			new Response('<h1>hi</h1>', { headers: { 'content-type': 'text/html' } });

		const response = await handle({ event, resolve } as never);
		expect(response.headers.get('content-type')).toBe('text/html');
		expect((event.locals as { negotiate?: string }).negotiate).toBeUndefined();
	});

	it('picks the higher q-valued negotiated type', async () => {
		const event = mockEvent({
			accept: 'text/html;q=0.5, text/markdown;q=0.7, application/json;q=0.9'
		});
		const resolve = async () =>
			new Response(htmlWithPayload('{"pick":"json"}'), {
				headers: { 'content-type': 'text/html' }
			});

		const response = await handle({ event, resolve } as never);
		expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
	});

	it('treats a wildcard Accept as equivalent to HTML (passes through)', async () => {
		const event = mockEvent({ accept: '*/*' });
		const resolve = async () =>
			new Response('<h1>hi</h1>', { headers: { 'content-type': 'text/html' } });

		const response = await handle({ event, resolve } as never);
		expect(response.headers.get('content-type')).toBe('text/html');
		expect((event.locals as { negotiate?: string }).negotiate).toBeUndefined();
	});

	it('matches a subtype wildcard like application/*', async () => {
		const event = mockEvent({ accept: 'application/*' });
		const resolve = async () =>
			new Response(htmlWithPayload('{"sub":"wildcard"}'), {
				headers: { 'content-type': 'text/html' }
			});

		const response = await handle({ event, resolve } as never);
		expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
	});

	it('uses the URL extension over the Accept header', async () => {
		const event = mockEvent({ pathname: '/post.md', accept: 'application/json' });
		const resolve = async () =>
			new Response(htmlWithPayload('# hello'), {
				headers: { 'content-type': 'text/html' }
			});

		const response = await handle({ event, resolve } as never);
		expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
		await expect(response.text()).resolves.toBe('# hello');
	});

	it('passes the response through when no Accept header is provided', async () => {
		const event = mockEvent();
		const resolve = async () =>
			new Response('<h1>hi</h1>', { headers: { 'content-type': 'text/html' } });

		const response = await handle({ event, resolve } as never);
		expect(response.headers.get('content-type')).toBe('text/html');
	});
});

describe('handle – response handling', () => {
	const { handle } = createNegotiation(types);

	it('returns 406 when the route has no payload for the negotiated type', async () => {
		const event = mockEvent({ accept: 'application/json' });
		const resolve = async () =>
			new Response('<h1>hi</h1>', { headers: { 'content-type': 'text/html' } });

		const response = await handle({ event, resolve } as never);
		expect(response.status).toBe(406);
		await expect(response.text()).resolves.toContain('application/json');
	});

	it('does not rewrite non-HTML responses', async () => {
		const event = mockEvent({ accept: 'application/json' });
		const resolve = async () =>
			new Response('{"already":"json"}', {
				headers: { 'content-type': 'application/json' }
			});

		const response = await handle({ event, resolve } as never);
		expect(response.headers.get('content-type')).toBe('application/json');
		await expect(response.text()).resolves.toBe('{"already":"json"}');
	});

	it('leaves non-ok responses alone', async () => {
		const event = mockEvent({ accept: 'application/json' });
		const resolve = async () =>
			new Response('oops', { status: 500, headers: { 'content-type': 'text/html' } });

		const response = await handle({ event, resolve } as never);
		expect(response.status).toBe(500);
		await expect(response.text()).resolves.toBe('oops');
	});

	it('unescapes </script> sequences embedded in the payload', async () => {
		const event = mockEvent({ accept: 'application/json' });
		const payload = '{"snippet":"</script>"}';
		const resolve = async () =>
			new Response(htmlWithPayload(payload), {
				headers: { 'content-type': 'text/html' }
			});

		const response = await handle({ event, resolve } as never);
		await expect(response.text()).resolves.toBe(payload);
	});
});

describe('handle – header preservation', () => {
	const { handle } = createNegotiation(types);

	it('keeps app headers on the negotiated response', async () => {
		const event = mockEvent({ accept: 'application/json' });
		const resolve = async () =>
			new Response(htmlWithPayload('{"ok":true}'), {
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'cache-control': 'max-age=600',
					'set-cookie': 'session=abc; Path=/',
					'x-sveltekit-routeid': '/demo',
					'x-frame-options': 'DENY'
				}
			});

		const response = await handle({ event, resolve } as never);
		expect(response.headers.get('cache-control')).toBe('max-age=600');
		expect(response.headers.get('set-cookie')).toBe('session=abc; Path=/');
		expect(response.headers.get('x-sveltekit-routeid')).toBe('/demo');
		expect(response.headers.get('x-frame-options')).toBe('DENY');
		expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
	});

	it('drops headers that describe the replaced body', async () => {
		const event = mockEvent({ accept: 'application/json' });
		const resolve = async () =>
			new Response(htmlWithPayload('{"ok":true}'), {
				headers: {
					'content-type': 'text/html',
					etag: '"html-version"',
					'content-length': '1234',
					'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT'
				}
			});

		const response = await handle({ event, resolve } as never);
		expect(response.headers.get('etag')).toBeNull();
		expect(response.headers.get('content-length')).toBeNull();
		expect(response.headers.get('last-modified')).toBeNull();
	});

	it('preserves the upstream status code', async () => {
		const event = mockEvent({ accept: 'application/json' });
		const resolve = async () =>
			new Response(htmlWithPayload('{"ok":true}'), {
				status: 203,
				headers: { 'content-type': 'text/html' }
			});

		const response = await handle({ event, resolve } as never);
		expect(response.status).toBe(203);
	});

	it('keeps cookies but not the caching policy on the 406', async () => {
		const event = mockEvent({ accept: 'application/json' });
		const resolve = async () =>
			new Response('<h1>hi</h1>', {
				headers: {
					'content-type': 'text/html',
					'cache-control': 'max-age=600',
					'set-cookie': 'session=abc; Path=/'
				}
			});

		const response = await handle({ event, resolve } as never);
		expect(response.status).toBe(406);
		expect(response.headers.get('set-cookie')).toBe('session=abc; Path=/');
		expect(response.headers.get('cache-control')).toBeNull();
		expect(response.headers.get('vary')).toBe('accept');
	});
});

describe('handle – vary', () => {
	const { handle } = createNegotiation(types);

	it('adds vary to an HTML response that was not negotiated', async () => {
		const event = mockEvent({ accept: 'text/html' });
		const resolve = async () =>
			new Response('<h1>hi</h1>', { headers: { 'content-type': 'text/html' } });

		const response = await handle({ event, resolve } as never);
		expect(response.headers.get('vary')).toBe('accept');
		await expect(response.text()).resolves.toBe('<h1>hi</h1>');
	});

	it('appends to an existing vary header', async () => {
		const event = mockEvent({ accept: 'text/html' });
		const resolve = async () =>
			new Response('<h1>hi</h1>', {
				headers: { 'content-type': 'text/html', vary: 'cookie' }
			});

		const response = await handle({ event, resolve } as never);
		expect(response.headers.get('vary')).toBe('cookie, accept');
	});

	it('does not duplicate an accept already present in vary', async () => {
		const event = mockEvent({ accept: 'text/html' });
		const resolve = async () =>
			new Response('<h1>hi</h1>', {
				headers: { 'content-type': 'text/html', vary: 'Accept' }
			});

		const response = await handle({ event, resolve } as never);
		expect(response.headers.get('vary')).toBe('Accept');
	});

	it('leaves a wildcard vary alone', async () => {
		const event = mockEvent({ accept: 'text/html' });
		const resolve = async () =>
			new Response('<h1>hi</h1>', {
				headers: { 'content-type': 'text/html', vary: '*' }
			});

		const response = await handle({ event, resolve } as never);
		expect(response.headers.get('vary')).toBe('*');
	});

	it('adds vary to a non-ok HTML response', async () => {
		const event = mockEvent({ accept: 'text/html' });
		const resolve = async () =>
			new Response('boom', { status: 500, headers: { 'content-type': 'text/html' } });

		const response = await handle({ event, resolve } as never);
		expect(response.status).toBe(500);
		expect(response.headers.get('vary')).toBe('accept');
	});

	it('does not add vary to non-HTML responses', async () => {
		const event = mockEvent({ accept: 'text/html' });
		const resolve = async () =>
			new Response('{"a":1}', { headers: { 'content-type': 'application/json' } });

		const response = await handle({ event, resolve } as never);
		expect(response.headers.get('vary')).toBeNull();
	});
});

describe('handle – url normalisation', () => {
	const { handle } = createNegotiation(types);

	it('strips the extension from event.url before resolving', async () => {
		const event = mockEvent({ pathname: '/posts/hello.md' });
		let seen: string | undefined;
		const resolve = async (resolved: RequestEvent) => {
			seen = resolved.url.pathname;
			return new Response(htmlWithPayload('# hello'), {
				headers: { 'content-type': 'text/html' }
			});
		};

		await handle({ event, resolve } as never);
		expect(seen).toBe('/posts/hello');
		expect(event.url.pathname).toBe('/posts/hello');
	});

	it('normalises a bare extension request to the root', async () => {
		const event = mockEvent({ pathname: '/.md' });
		const resolve = async () =>
			new Response(htmlWithPayload('# hello'), { headers: { 'content-type': 'text/html' } });

		await handle({ event, resolve } as never);
		expect(event.url.pathname).toBe('/');
	});

	it('leaves the url alone when the type came from the Accept header', async () => {
		const event = mockEvent({ pathname: '/posts/hello', accept: 'text/markdown' });
		const resolve = async () =>
			new Response(htmlWithPayload('# hello'), { headers: { 'content-type': 'text/html' } });

		await handle({ event, resolve } as never);
		expect(event.url.pathname).toBe('/posts/hello');
	});
});

describe('handle – payload decoding', () => {
	const { handle } = createNegotiation(types);

	it('unescapes </script sequences that have no trailing bracket', async () => {
		const event = mockEvent({ accept: 'text/markdown' });
		const payload = 'before </script after\nand </scriptfoo too';
		const resolve = async () =>
			new Response(htmlWithPayload(payload), { headers: { 'content-type': 'text/html' } });

		const response = await handle({ event, resolve } as never);
		await expect(response.text()).resolves.toBe(payload);
	});

	it('preserves leading and trailing whitespace in the payload', async () => {
		const event = mockEvent({ accept: 'text/markdown' });
		const payload = '# Title\n\nBody text\n';
		const resolve = async () =>
			new Response(htmlWithPayload(payload), { headers: { 'content-type': 'text/html' } });

		const response = await handle({ event, resolve } as never);
		await expect(response.text()).resolves.toBe(payload);
	});
});

describe('negotiate', () => {
	const { negotiate } = createNegotiation({
		'text/markdown': { extension: '.md' },
		'application/json': { extension: '.json' },
		'application/xml': {
			extension: '.xml',
			serialize: (value) => `<root>${String((value as { msg: string }).msg)}</root>`
		}
	});

	it('returns an empty object when no type was negotiated', () => {
		expect(negotiate({} as App.Locals, { 'text/markdown': () => '# hi' })).toEqual({});
	});

	it('returns an empty object when the handler is missing for the negotiated type', () => {
		const locals = { negotiate: 'application/json' } as unknown as App.Locals;
		expect(negotiate(locals, { 'text/markdown': () => '# hi' })).toEqual({});
	});

	it('returns the payload keyed under __negotiate for the negotiated type', () => {
		const locals = { negotiate: 'text/markdown' } as unknown as App.Locals;
		expect(negotiate(locals, { 'text/markdown': () => '# hi' })).toEqual({
			__negotiate: '# hi'
		});
	});

	it('uses the default JSON serialiser for non-string values', () => {
		const locals = { negotiate: 'application/json' } as unknown as App.Locals;
		const result = negotiate(locals, {
			'application/json': () => ({ title: 'hello' })
		});
		expect(result).toEqual({ __negotiate: JSON.stringify({ title: 'hello' }, null, 2) });
	});

	it('honours a custom serialiser registered on the type', () => {
		const locals = { negotiate: 'application/xml' } as unknown as App.Locals;
		const result = negotiate(locals, {
			'application/xml': () => ({ msg: 'hi' })
		});
		expect(result).toEqual({ __negotiate: '<root>hi</root>' });
	});
});
