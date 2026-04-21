<script lang="ts">
	let { data } = $props();

	const post = $derived(data.post);

	const formats = [
		{ label: 'HTML', href: '/demo', type: 'text/html' },
		{ label: 'Markdown', href: '/demo.md', type: 'text/markdown' },
		{ label: 'JSON', href: '/demo.json', type: 'application/json' }
	];

	const origin = 'http://localhost:5173';

	const publishedLong = $derived(
		new Date(post.published).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
	);

	const codeSnippet = $derived(
		`# as Markdown\ncurl -H 'Accept: text/markdown' ${origin}/demo\n\n# as JSON\ncurl -H 'Accept: application/json' ${origin}/demo\n\n# or via the URL extension\ncurl ${origin}/demo.md`.replace(
			/\n/g,
			'\n'
		)
	);
</script>

<svelte:head>
	<title>{post.title} — sveltekit-negotiate</title>
	<meta name="description" content="A demo of content negotiation in SvelteKit." />
</svelte:head>

<main>
	<header>
		<p class="eyebrow">
			<a href="/">sveltekit-negotiate</a> · demo
		</p>
		<h1>{post.title}</h1>
		<p class="byline">
			<span>{post.author}</span>
			<span aria-hidden="true">·</span>
			<time datetime={post.published}>{publishedLong}</time>
		</p>
	</header>

	<article>
		{#each post.body.split('\n\n') as paragraph}
			<p>{paragraph}</p>
		{/each}
	</article>

	<section class="try">
		<h2>Try it</h2>
		<p>
			The browser requested this page as <code>text/html</code>. Ask for a different format and
			you'll get the same data, serialized differently.
		</p>

		<nav aria-label="View this page as">
			{#each formats as format}
				<a href={format.href} data-sveltekit-reload>
					<span class="fmt">{format.label}</span>
					<span class="mime">{format.type}</span>
				</a>
			{/each}
		</nav>

		<h3>With curl</h3>
		<pre><code>{codeSnippet}</code></pre>
	</section>

	<footer>
		<a href="https://github.com/nathancahill/sveltekit-negotiate">Read the docs on GitHub →</a>
	</footer>
</main>

<style>
	:global(html) {
		background: #fafaf7;
		color: #1a1a1a;
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		line-height: 1.6;
	}

	:global(body) {
		margin: 0;
	}

	main {
		max-width: 40rem;
		margin: 0 auto;
		padding: 4rem 1.5rem 6rem;
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		font-size: 0.8rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #8a6b3a;
	}

	.eyebrow a {
		color: inherit;
		text-decoration: none;
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 2.75rem);
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.byline {
		margin: 0.75rem 0 0;
		color: #6b6b6b;
		font-size: 0.95rem;
	}

	.byline span + span {
		margin-left: 0.5rem;
	}

	article {
		margin-top: 2rem;
		font-size: 1.05rem;
	}

	article p {
		margin: 0 0 1em;
	}

	article :global(code) {
		background: #eee8d8;
		padding: 0.1em 0.35em;
		border-radius: 4px;
		font-size: 0.9em;
	}

	.try {
		margin-top: 2rem;
		padding: 2rem;
		background: #fff;
		border: 1px solid #ece7d5;
		border-radius: 12px;
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
	}

	.try h2 {
		margin: 0 0 0.5rem;
		font-size: 1.35rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.try h3 {
		margin: 2rem 0 0.75rem;
		font-size: 0.9rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #6b6b6b;
	}

	.try p {
		margin: 0;
		color: #444;
	}

	nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	nav a {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.9rem 1rem;
		background: #fafaf7;
		border: 1px solid #ece7d5;
		border-radius: 8px;
		color: #1a1a1a;
		text-decoration: none;
		transition:
			border-color 0.15s ease,
			transform 0.15s ease;
	}

	nav a:hover {
		border-color: #c9a15a;
		transform: translateY(-1px);
	}

	.fmt {
		font-weight: 600;
	}

	.mime {
		color: #6b6b6b;
		font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
		font-size: 0.8rem;
	}

	pre {
		margin: 0;
		padding: 1rem 1.25rem;
		background: #1f1d18;
		color: #f1ece0;
		border-radius: 8px;
		font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
		font-size: 0.85rem;
		line-height: 1.7;
		overflow-x: auto;
	}

	pre code {
		background: transparent;
		padding: 0;
		color: inherit;
	}

	footer {
		margin-top: 3rem;
		text-align: center;
	}

	footer a {
		color: #8a6b3a;
		text-decoration: none;
		font-weight: 500;
	}

	footer a:hover {
		text-decoration: underline;
	}
</style>
