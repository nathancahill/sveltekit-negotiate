import type { Handle, RequestEvent } from '@sveltejs/kit';
import type { Component } from 'svelte';

import NegotiateComponent from './negotiate.svelte';

const Negotiate: Component<Record<string, never>> = NegotiateComponent;

const NEGOTIATE_ID = '__negotiate';

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

	function pickType(event: RequestEvent): Mime | null {
		for (const [ext, mime] of extensionToMime) {
			if (event.url.pathname.endsWith(ext)) return mime;
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

		return bestQ > htmlQ ? bestMime : null;
	}

	const handle: Handle = async ({ event, resolve }) => {
		const negotiated = pickType(event);
		// @ts-ignore
		event.locals.negotiate = negotiated ?? undefined;

		const response = await resolve(event);

		if (!negotiated) return response;
		if (!response.ok) return response;

		const contentType = response.headers.get('content-type') ?? '';
		if (!contentType.includes('text/html')) return response;

		const html = await response.text();
		const match = html.match(extractRegex);

		if (!match) {
			return new Response(`No payload registered for ${negotiated} on this route.`, {
				status: 406,
				headers: { 'content-type': 'text/plain; charset=utf-8' }
			});
		}

		const content = match[1].trim().replace(/<\\\/script>/gi, '</script>');

		return new Response(content, {
			headers: {
				'content-type': `${negotiated}; charset=utf-8`,
				vary: 'accept'
			}
		});
	};

	const reroute = (url: string) => {
		for (const ext of extensionToMime.keys()) {
			if (url.endsWith(ext)) {
				const stripped = url.slice(0, -ext.length);
				return stripped === '' ? '/' : stripped;
			}
		}
		return url;
	};

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
