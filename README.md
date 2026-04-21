# sveltekit-negotiate

Drop-in [HTTP content negotiation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Content_negotiation)
for SvelteKit. Serve the same route as HTML, Markdown, JSON, XML — or any other
format you choose — driven by the client's `Accept` header or a URL extension.

Write your data once in a `load` function and let your callers decide how they
want it.

```sh
curl -H 'Accept: text/html'         https://example.com/posts/hello   # rendered page
curl -H 'Accept: text/markdown'     https://example.com/posts/hello   # raw markdown
curl -H 'Accept: application/json'  https://example.com/posts/hello   # json payload
curl                                https://example.com/posts/hello.md  # via extension
```

## Features

- Content negotiation driven by the `Accept` header (with full q-value support)
- URL extension fallback (`/posts/hello.md`, `/posts/hello.json`, …)
- Works with SvelteKit's regular `load` functions — no bespoke endpoints
- Pluggable per-type serializers (JSON, Markdown, XML, YAML, anything)
- Tiny, zero runtime dependencies, fully typed
- Sets the `Vary: accept` header so caches behave correctly

## Install

```sh
npm install sveltekit-negotiate
# or
pnpm add sveltekit-negotiate
# or
yarn add sveltekit-negotiate
```

Requires Svelte 5 and SvelteKit 2.

## Quick start

### 1. Configure the negotiated types

Create a single module where you declare the types you want to support. The
returned helpers are bound to that configuration.

```ts
// src/lib/negotiate.ts
import { createNegotiation } from 'sveltekit-negotiate';

export const { handle, reroute, negotiate, Negotiate } = createNegotiation({
	'text/markdown': { extension: '.md' },
	'application/json': { extension: '.json' }
});
```

### 2. Wire up the hooks

`handle` inspects the request, flags the chosen type on `event.locals`, and
rewrites the rendered HTML response to the negotiated payload on the way out.
`reroute` lets `/posts/hello.md` hit the same route as `/posts/hello`.

```ts
// src/hooks.server.ts
export { handle } from '$lib/negotiate';
```

```ts
// src/hooks.ts
export { reroute } from '$lib/negotiate';
```

### 3. Mount the `<Negotiate />` component in your layout

The component writes the negotiated payload into `<svelte:head>` so `handle`
can pluck it back out server-side. Put it in your root layout once.

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import { Negotiate } from '$lib/negotiate';

	let { children } = $props();
</script>

<Negotiate />

{@render children?.()}
```

### 4. Return per-type payloads from your `load`

Call `negotiate()` inside any `load` that wants to participate. Each handler
only runs when its type was actually selected, so rendering Markdown doesn't
cost you a JSON serialization.

```ts
// src/routes/posts/[slug]/+page.server.ts
import { negotiate } from '$lib/negotiate';

export const load = async ({ params, locals }) => {
	const post = await getPost(params.slug);

	return {
		post,
		...negotiate(locals, {
			'text/markdown': () => post.body,
			'application/json': () => ({ slug: post.slug, title: post.title, body: post.body })
		})
	};
};
```

```svelte
<!-- src/routes/posts/[slug]/+page.svelte -->
<script lang="ts">
	let { data } = $props();
</script>

<h1>{data.post.title}</h1><article>{@html data.post.rendered}</article>
```

That's it. The same URL now serves HTML, Markdown, or JSON depending on who's
asking.

## How it works

1. On each request, `handle` parses the `Accept` header (and the URL
   extension), compares it to the registered types, and picks the best
   match. If `text/html` is tied or preferred it does nothing and SvelteKit
   renders normally.
2. When a non-HTML type is chosen, `handle` stashes it on
   `event.locals.negotiate` and lets the page render as usual.
3. Any `load` that called `negotiate(locals, { … })` produces a
   serialized payload which the `<Negotiate />` component embeds in
   `<svelte:head>` as `<script type="text/plain" id="__negotiate">…</script>`.
4. On the way back out, `handle` extracts that payload, returns it with the
   negotiated `Content-Type`, and adds `Vary: accept` so CDNs cache
   correctly.
5. `reroute` rewrites `/foo.md` → `/foo` so extension-based URLs hit the
   normal route tree.

If the negotiated type has no handler on a route, `handle` responds with a
`406 Not Acceptable`.

## API

### `createNegotiation(types)`

Creates the bound helpers for a set of MIME types.

```ts
createNegotiation({
	'text/markdown': { extension: '.md' },
	'application/json': { extension: '.json' },
	'application/xml': {
		extension: '.xml',
		serialize: (value) => toXml(value)
	}
});
```

Each entry takes:

| Field       | Type                         | Description                                                                                      |
| ----------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `extension` | `string`                     | URL suffix that maps to this MIME type (include the leading dot).                                |
| `serialize` | `(value: unknown) => string` | Optional. Defaults to `JSON.stringify(value, null, 2)`, or the value itself if already a string. |

Returns `{ handle, reroute, negotiate, Negotiate }`.

### `handle`

A SvelteKit [`Handle`](https://svelte.dev/docs/kit/hooks#server-hooks-handle)
you re-export from `src/hooks.server.ts`. Compose it with other hooks via
[`sequence`](https://svelte.dev/docs/kit/@sveltejs-kit-hooks#sequence) if
needed.

```ts
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import { handle as negotiate } from '$lib/negotiate';
import { handle as auth } from '$lib/auth';

export const handle = sequence(negotiate, auth);
```

### `reroute`

A SvelteKit [`Reroute`](https://svelte.dev/docs/kit/hooks#universal-hooks-reroute)
that strips registered extensions so `/posts/hello.md` resolves to the
`/posts/hello` route.

### `negotiate(locals, handlers)`

Call inside any `load` to produce the serialized payload for the negotiated
type. Returns an empty object when no type was negotiated or when the route
doesn't handle the selected type, so it's safe to spread unconditionally.

```ts
return {
	post,
	...negotiate(locals, {
		'text/markdown': () => post.body,
		'application/json': () => ({ title: post.title })
	})
};
```

Handlers are only invoked when their type was actually chosen.

### `<Negotiate />`

Component that embeds the serialized payload into `<svelte:head>` where
`handle` can find it. Render it once in your root layout.

## Recipes

### Custom serializer

```ts
import YAML from 'yaml';
import { createNegotiation } from 'sveltekit-negotiate';

export const { handle, reroute, negotiate, Negotiate } = createNegotiation({
	'application/yaml': {
		extension: '.yaml',
		serialize: (value) => YAML.stringify(value)
	}
});
```

### Typed `locals`

If you want `event.locals.negotiate` to be strongly typed, extend `App.Locals`
in `src/app.d.ts`:

```ts
declare global {
	namespace App {
		interface Locals {
			negotiate?: 'text/markdown' | 'application/json';
		}
	}
}

export {};
```

## Developing

Once you've installed dependencies with `npm install`, start the showcase app:

```sh
npm run dev
# or open the app in a new browser tab
npm run dev -- --open
```

Everything inside `src/lib` is the library, `src/routes` is a preview app.

Run the test suite:

```sh
npm test           # run once
npm run test:unit  # watch mode
```

Type-check with `npm run check` and format with `npm run format`.

## Building & publishing

Build a publishable package:

```sh
npm run build
```

Pack it locally to inspect the tarball:

```sh
npm pack
```

Publish to [npm](https://www.npmjs.com):

```sh
npm publish
```

## License

MIT
