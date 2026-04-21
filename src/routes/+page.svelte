<svelte:head>
	<title>sveltekit-negotiate</title>
	<meta
		name="description"
		content="Drop-in content negotiation for SvelteKit — serve HTML, Markdown, JSON and more from the same route."
	/>
</svelte:head>

<main>
	<p class="eyebrow">
		<a href="/">sveltekit-negotiate</a>
	</p>
	<h1>Content negotiation for SvelteKit.</h1>
	<p class="lede">
		Serve the same route as HTML, Markdown, JSON — or anything else you register — driven by the
		client's <code>Accept</code> header or a URL extension. One <code>load</code>, many formats.
	</p>

	<div class="ctas">
		<a class="primary" href="/demo" data-sveltekit-preload-data="tap">See the demo →</a>
		<a class="ghost" href="https://github.com/nathancahill/sveltekit-negotiate">GitHub</a>
	</div>
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
		max-width: 38rem;
		margin: 0 auto;
		padding: min(12vh, 7rem) 1.5rem 4rem;
	}

	.eyebrow {
		margin: 0 0 1rem;
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
		font-size: clamp(2.25rem, 6vw, 3.25rem);
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1.05;
	}

	.lede {
		margin: 1.25rem 0 0;
		font-size: 1.15rem;
		color: #3a3a3a;
	}

	.lede code {
		background: #eee8d8;
		padding: 0.1em 0.35em;
		border-radius: 4px;
		font-size: 0.9em;
	}

	.ctas {
		margin-top: 2rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.ctas a {
		display: inline-flex;
		align-items: center;
		padding: 0.75rem 1.25rem;
		border-radius: 8px;
		font-weight: 500;
		text-decoration: none;
		transition:
			transform 0.15s ease,
			border-color 0.15s ease,
			background 0.15s ease;
	}

	.primary {
		background: #1a1a1a;
		color: #fafaf7;
	}

	.primary:hover {
		transform: translateY(-1px);
		background: #000;
	}

	.ghost {
		color: #1a1a1a;
		border: 1px solid #d9d2bd;
		background: #fff;
	}

	.ghost:hover {
		border-color: #8a6b3a;
	}
</style>
