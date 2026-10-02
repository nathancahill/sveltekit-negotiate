// The payload markup lives here rather than in negotiate.svelte on purpose. `svelte-package`
// runs a plain-text regex (`strip_lang_tags`) over every preprocessed `.svelte` file that drops
// `type="…"` from anything that looks like `<script …>` — including a string inside `{@html}`.
// Kit 3 always registers a preprocessor, so that strip always runs, and 0.3.0 shipped an
// executable `<script id="__negotiate">` that `extractPayload` could no longer find. `.ts`
// modules never go through that step.

export const NEGOTIATE_ID = '__negotiate';

// `text/plain` keeps browsers from executing the payload; it is only there to be read back.
const OPEN_TAG = `<script type="text/plain" id="${NEGOTIATE_ID}">`;

// Matches on the id alone, in any attribute position, so the type (or attribute order) changing
// can't silently turn every negotiated request into a 406.
const EXTRACT_REGEX = new RegExp(
	`<script\\b[^>]*\\bid=["']${NEGOTIATE_ID}["'][^>]*>([\\s\\S]*?)<\\/script>`,
	'i'
);

// Escape `</script` (with or without a trailing `>`) so the payload can't close the tag early.
export function renderPayload(raw: string): string {
	return `${OPEN_TAG}${raw.replace(/<\/script/gi, '<\\/script')}</script>`;
}

// Mirrors the escape in `renderPayload` exactly. Doesn't trim: the payload is interpolated
// verbatim, so any leading or trailing whitespace belongs to it.
export function extractPayload(html: string): string | null {
	const match = html.match(EXTRACT_REGEX);
	return match ? match[1].replace(/<\\\/script/gi, '</script') : null;
}
