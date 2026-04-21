import { negotiate } from '../../negotiate.ts';

const post = {
	slug: 'hello-world',
	title: 'Hello, world!',
	published: '2026-04-20',
	author: 'Nathan Cahill',
	body: [
		'`sveltekit-negotiate` lets a single SvelteKit route answer with HTML, Markdown,',
		'JSON — or whatever formats you register — based on the client\u2019s `Accept`',
		'header or a URL extension.',
		'',
		'This page, for instance, is the same route served three ways.'
	].join('\n')
};

function toMarkdown() {
	return `---
title: ${post.title}
author: ${post.author}
published: ${post.published}
---

# ${post.title}

${post.body}
`;
}

function toJson() {
	return {
		slug: post.slug,
		title: post.title,
		author: post.author,
		published: post.published,
		body: post.body
	};
}

export const load = ({ locals }) => {
	return {
		post,
		...negotiate(locals, {
			'text/markdown': toMarkdown,
			'application/json': toJson
		})
	};
};
