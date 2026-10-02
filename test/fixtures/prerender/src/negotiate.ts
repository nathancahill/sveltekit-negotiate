import { createNegotiation } from '../../../../src/lib/index.ts';

export const { handle, reroute, negotiate, Negotiate } = createNegotiation({
	'text/markdown': { extension: '.md' },
	'application/json': { extension: '.json' }
});
