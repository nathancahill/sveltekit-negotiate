<script lang="ts">
	import { page } from '$app/state';
	import { NEGOTIATE_ID, renderPayload } from './payload.ts';

	// The markup is built in payload.ts: see the note there for why it can't live in this file.
	const raw = page.data[NEGOTIATE_ID] as string | undefined;
</script>

<svelte:head>
	{#if raw !== undefined}
		{@html renderPayload(raw)}
	{/if}
</svelte:head>
