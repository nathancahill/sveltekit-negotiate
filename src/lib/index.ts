import type { Handle, RequestEvent } from '@sveltejs/kit';
import type { Component } from 'svelte';

import NegotiateComponent from './negotiate.svelte';

const Negotiate: Component<Record<string, never>> = NegotiateComponent;

const NEGOTIATE_ID = '__negotiate';

// These describe the body we are about to replace. Carrying an ETag over to a different
// representation would let a cache serve it under the HTML's validator.
const STALE_BODY_HEADERS = ['content-length', 'content-encoding', 'etag', 'last-modified'];

export type TypeConfig = {
	extension: string;
	serialize?: (value: unknown) => string;
};

type AcceptEntry = { type: string; q: number };

// Minimal RFC 7231 Accept parser: splits entries, reads q-values, lowercases types.
function parseAccept(header: string | null): AcceptEntry[] {
	if (!header) return [];
	const entries: AcceptEntry[] = [];
	for (const part of header.split(',')) {
		const segments = part
			.trim()
			.split(';')
			.map((s) => s.trim());
		const rawType = segments.shift();
		if (!rawType) continue;
		let q = 1;
		for (const param of segments) {
			if (param.startsWith('q=')) {
				const parsed = Number.parseFloat(param.slice(2));
				if (!Number.isNaN(parsed)) q = parsed;
			}
		}
		entries.push({ type: rawType.toLowerCase(), q });
	}
	return entries;
}

// Best q-value for which the Accept header matches `target`, including wildcards.
function matchQ(entries: AcceptEntry[], target: string): number {
	const [main] = target.split('/');
	let best = 0;
	for (const entry of entries) {
		const matches = entry.type === target || entry.type === `${main}/*` || entry.type === '*/*';
		if (matches && entry.q > best) best = entry.q;
	}
	return best;
}

// Whether `vary` already covers `field`, or is a wildcard.
function varyIncludes(headers: Headers, field: string): boolean {
	const existing = headers.get('vary');
	if (!existing) return false;
	const parts = existing.split(',').map((value) => value.trim().toLowerCase());
	return parts.includes('*') || parts.includes(field);
}

// Seed from the app's headers so `setHeaders()` values, cookies, security headers set by an
// inner hook and `x-sveltekit-routeid` all survive the rewrite.
function carryHeaders(source: Headers, contentType: string, drop: string[] = []): Headers {
	const headers = new Headers(source);
	for (const name of [...STALE_BODY_HEADERS, ...drop]) headers.delete(name);
	headers.set('content-type', contentType);
	if (!varyIncludes(headers, 'accept')) headers.append('vary', 'accept');
	return headers;
}

// Clone before mutating: a response handed back by another hook in `sequence()` may have
// immutable headers. Mirrors SvelteKit's own approach in its `Vary: Accept` handling.
function withVary(response: Response): Response {
	if (varyIncludes(response.headers, 'accept')) return response;
	// Null-body statuses cannot be reconstructed with a body; a 304 already inherits `vary`
	// from the 200 it revalidates.
	if (response.status === 204 || response.status === 304) return response;

	const cloned = new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: new Headers(response.headers)
	});
	cloned.headers.append('vary', 'accept');
	return cloned;
}

const defaultSerialize = (value: unknown): string =>
	typeof value === 'string' ? value : JSON.stringify(value, null, 2);

export function createNegotiation<T extends Record<string, TypeConfig>>(types: T) {
	type Mime = keyof T & string;

	const entries = Object.entries(types) as [Mime, TypeConfig][];
	const extensionToMime = new Map<string, Mime>(
		entries.map(([mime, cfg]) => [cfg.extension, mime])
	);
	const mimes = entries.map(([mime]) => mime);

	const extractRegex = new RegExp(
		`<script[^>]*type=["']text\\/plain["'][^>]*id=["']${NEGOTIATE_ID}["'][^>]*>([\\s\\S]*?)<\\/script>`,
		'i'
	);

	// Shared by `reroute` and `handle` so the two can't drift.
	function stripExtension(pathname: string): string | null {
		for (const ext of extensionToMime.keys()) {
			if (pathname.endsWith(ext)) {
				const stripped = pathname.slice(0, -ext.length);
				return stripped === '' ? '/' : stripped;
			}
		}
		return null;
	}

	type Match = { mime: Mime; extension: string | null };

	function pickType(event: RequestEvent): Match | null {
		for (const [ext, mime] of extensionToMime) {
			if (event.url.pathname.endsWith(ext)) return { mime, extension: ext };
		}

		const parsed = parseAccept(event.request.headers.get('accept'));
		if (parsed.length === 0) return null;

		const htmlQ = matchQ(parsed, 'text/html');

		let bestMime: Mime | null = null;
		let bestQ = 0;
		for (const mime of mimes) {
			const q = matchQ(parsed, mime);
			if (q > bestQ) {
				bestQ = q;
				bestMime = mime;
			}
		}

		return bestQ > htmlQ && bestMime ? { mime: bestMime, extension: null } : null;
	}

	const handle: Handle = async ({ event, resolve }) => {
		const matched = pickType(event);
		// @ts-ignore
		event.locals.negotiate = matched?.mime ?? undefined;

		// SvelteKit derives the prerender data path from `event.url`, and its `add_data_suffix`
		// special-cases only `.html` — so `/foo.md` yields `/foo.md/__data.json`, whose directory
		// collides with the file written at `build/foo.md`. Routing has already happened (via
		// `reroute`), so normalising the URL here cannot affect `event.route` or `event.params`.
		// Mutate in place rather than reassigning: `event.url` is shared by reference, and while
		// prerendering it carries throwing `search`/`searchParams` getters that a fresh URL would
		// silently discard.
		if (matched?.extension) {
			event.url.pathname = stripExtension(event.url.pathname) ?? event.url.pathname;
		}

		const response = await resolve(event);

		const contentType = response.headers.get('content-type') ?? '';
		const isHtml = contentType.includes('text/html');

		// Any HTML response for this URL could have been negotiated, so it has to vary on Accept
		// even when it wasn't — otherwise a shared cache stores the HTML and serves it to the next
		// client asking for another type.
		if (!matched || !response.ok || !isHtml) {
			return isHtml ? withVary(response) : response;
		}

		const html = await response.text();
		const match = html.match(extractRegex);

		if (!match) {
			return new Response(`No payload registered for ${matched.mime} on this route.`, {
				status: 406,
				// Keep cookies and security headers, but don't cache an error under the page's own
				// caching policy.
				headers: carryHeaders(response.headers, 'text/plain; charset=utf-8', ['cache-control'])
			});
		}

		// Mirror the escape in negotiate.svelte exactly — it matches `</script` with no trailing
		// `>`. Don't trim: the component interpolates the payload verbatim, so any leading or
		// trailing whitespace belongs to the payload.
		const content = match[1].replace(/<\\\/script/gi, '</script');

		return new Response(content, {
			status: response.status,
			statusText: response.statusText,
			headers: carryHeaders(response.headers, `${matched.mime}; charset=utf-8`)
		});
	};

	const reroute = (url: string) => stripExtension(url) ?? url;

	type Handlers = Partial<Record<Mime, () => string | object>>;

	function negotiate(
		locals: App.Locals,
		handlers: Handlers
	): Record<typeof NEGOTIATE_ID, string> | Record<string, never> {
		// @ts-ignore
		const type = locals.negotiate as Mime | undefined;
		if (!type) return {};

		const handler = handlers[type];
		if (!handler) return {};

		const serialize = types[type].serialize ?? defaultSerialize;
		return { [NEGOTIATE_ID]: serialize(handler()) };
	}

	return { handle, reroute, negotiate, Negotiate };
}
