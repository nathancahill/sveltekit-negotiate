// Resolved by the alias in vite.config.ts, to either the source or the packaged library.
import { createNegotiation } from 'negotiate-under-test';

export const { handle, reroute, negotiate, Negotiate } = createNegotiation({
	'text/markdown': { extension: '.md' },
	'application/json': { extension: '.json' }
});
