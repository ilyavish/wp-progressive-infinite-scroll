'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const adapters = require('../assets/js/adapters.js');

function documentFor(html, url = 'https://holdmyvodka.com/') {
	return new JSDOM(html, { url }).window.document;
}

test('detects the official P2 structure and older-post URL', () => {
	const document = documentFor(`
		<div id="main"><ul id="postlist">
			<li id="prologue-42" class="post hentry"><a class="thepermalink" href="/post/42/">Post</a></li>
		</ul><div class="navigation"><p class="nav-older"><a href="/page/2/">Older posts</a></p></div></div>
	`);
	const result = adapters.detect(document, { theme: 'p2', selectors: {} });
	assert.equal(result.name, 'p2');
	assert.equal(result.posts.length, 1);
	assert.equal(result.nextPageUrl, 'https://holdmyvodka.com/page/2/');
});

test('detects the P2 Resurrected structure and numbered next-page URL', () => {
	const document = documentFor(`
		<div id="main"><ul id="postlist">
			<li id="prologue-84" class="post hentry"><a class="thepermalink" href="/post/84/">Post</a></li>
		</ul><nav class="navigation pagination" aria-label="Posts pagination"><div class="nav-links">
			<span class="page-numbers current">1</span>
			<a class="page-numbers" href="/page/2/">2</a>
			<a class="next page-numbers" href="/page/2/">Older Posts →</a>
		</div></nav></div>
	`);
	const result = adapters.detect(document, { theme: 'p2-resurrected', selectors: {} });
	assert.equal(result.name, 'p2-resurrected');
	assert.equal(result.posts.length, 1);
	assert.equal(result.nextPageUrl, 'https://holdmyvodka.com/page/2/');
});

test('detects Kadence and appends complete archive list items', () => {
	const document = documentFor(`
		<div id="main" class="site-main">
			<ul id="archive-container" class="content-wrap kadence-posts-list grid-cols post-archive">
				<li class="entry-list-item"><article class="entry loop-entry post-25912 post"><h2><a rel="bookmark" href="/place/">Place</a></h2></article></li>
			</ul>
			<nav class="navigation pagination"><div class="nav-links">
				<span class="page-numbers current">1</span>
				<a class="next page-numbers" href="/page/2/"><span>Next Page</span></a>
			</div></nav>
		</div>
	`, 'https://unusualplaces.org/');
	const result = adapters.detect(document, { theme: 'kadence', selectors: {} });
	assert.equal(result.name, 'kadence');
	assert.equal(result.feedContainer.id, 'archive-container');
	assert.equal(result.posts.length, 1);
	assert.equal(result.posts[0].tagName, 'LI');
	assert.equal(result.nextPageUrl, 'https://unusualplaces.org/page/2/');
});

test('detects one block Query loop', () => {
	const document = documentFor(`
		<div class="wp-block-query"><ul class="wp-block-post-template">
			<li class="wp-block-post post-12"><a href="/post/12/">Post</a></li>
		</ul><nav class="wp-block-query-pagination"><a class="wp-block-query-pagination-next" href="/page/2/">Next</a></nav></div>
	`);
	const result = adapters.detect(document, { theme: 'generic', selectors: {} });
	assert.equal(result.name, 'block');
	assert.equal(result.posts.length, 1);
});

test('detects a direct classic feed without selecting nested articles', () => {
	const document = documentFor(`
		<main class="site-main"><article id="post-7" class="post hentry"><a rel="bookmark" href="/post/7/">Post</a></article></main>
		<nav class="posts-navigation"><div class="nav-previous"><a href="/page/2/">Older</a></div></nav>
	`);
	const result = adapters.detect(document, { theme: 'generic', selectors: {} });
	assert.equal(result.name, 'generic');
	assert.equal(result.feedContainer.className, 'site-main');
});

test('fails safely when more than one block Query loop exists', () => {
	const document = documentFor(`
		<div class="wp-block-query"><ul class="wp-block-post-template"><li class="wp-block-post">A</li></ul><nav class="wp-block-query-pagination"><a class="wp-block-query-pagination-next" href="/page/2/">Next</a></nav></div>
		<div class="wp-block-query"><ul class="wp-block-post-template"><li class="wp-block-post">B</li></ul><nav class="wp-block-query-pagination"><a class="wp-block-query-pagination-next" href="/news/page/2/">Next</a></nav></div>
	`);
	assert.equal(adapters.detect(document, { theme: 'generic', selectors: {} }), null);
});

test('accepts a final page whose pagination has no older link', () => {
	const document = documentFor(`
		<div id="main"><ul id="postlist"><li id="prologue-1" class="post">Last</li></ul><div class="navigation"><p class="nav-newer"><a href="/">Newer</a></p></div></div>
	`);
	const result = adapters.p2(document);
	assert.equal(result.posts.length, 1);
	assert.equal(result.nextPageUrl, null);
});

test('manual selectors must resolve to exactly one safe structure', () => {
	const document = documentFor(`
		<section id="feed"><div class="card"><a href="/one/">One</a></div></section>
		<nav id="pager"><a class="older" href="/page/2/">Older</a></nav>
	`);
	const result = adapters.manual(document, { feed: '#feed', post: ':scope > .card', pagination: '#pager', next: '.older' });
	assert.equal(result.name, 'manual');
	assert.equal(result.posts.length, 1);
	assert.equal(adapters.manual(document, { feed: '[', post: '.card', pagination: '#pager', next: '.older' }), null);
});
