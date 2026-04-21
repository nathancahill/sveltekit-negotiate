<script lang="ts">
  import { page } from "$app/state";

  const NEGOTIATE_ID = "__negotiate";
  const raw = page.data[NEGOTIATE_ID] as string | undefined;
  const encoded = raw?.replace(/<\/script/gi, "<\\/script");
</script>

<svelte:head>
  {#if encoded !== undefined}
    {@html `<script type="text/plain" id="${NEGOTIATE_ID}">${encoded}</script>`}
  {/if}
</svelte:head>
