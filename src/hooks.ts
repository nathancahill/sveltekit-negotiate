import type { Reroute } from '@sveltejs/kit';

import { reroute as negotiateReroute } from './negotiate.ts';

export const reroute: Reroute = ({ url }) => negotiateReroute(url.pathname);
