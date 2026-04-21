<script lang="ts">
	import { Negotiate } from '../negotiate.ts';

	let { children } = $props();
</script>

<Negotiate />

{@render children?.()}
