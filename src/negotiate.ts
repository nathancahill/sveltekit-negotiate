import { createNegotiation } from '$lib/index.js';

export const { handle, reroute, negotiate, Negotiate } = createNegotiation({
	'text/markdown': { extension: '.md' },
	'application/json': { extension: '.json' }
});
