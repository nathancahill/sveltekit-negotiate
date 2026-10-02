import { negotiate } from '../../negotiate.ts';

export const load = ({ locals }: { locals: App.Locals }) => ({
	title: 'Hello',
	...negotiate(locals, {
		'text/markdown': () => '---\ntitle: Hello\n---\n\n# Hello\n',
		'application/json': () => ({ title: 'Hello', ok: true })
	})
});
