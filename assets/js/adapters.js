(function (root, factory) {
	'use strict';
	if (typeof module === 'object' && module.exports) {
		module.exports = factory();
	} else {
		root.WPPFISAdapters = factory();
	}
}(typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	function one(document, selector) {
		if (!selector) return null;
		try {
			var matches = document.querySelectorAll(selector);
			return matches.length === 1 ? matches[0] : null;
		} catch (error) {
			return null;
		}
	}

	function scopedPosts(container, selector) {
		try {
			return Array.prototype.filter.call(container.querySelectorAll(selector), function (post) {
				return post.parentElement === container;
			});
		} catch (error) {
			return [];
		}
	}

	function result(name, container, postSelector, pagination, nextSelector) {
		if (!container || !pagination) return null;
		var posts = scopedPosts(container, postSelector);
		var next = null;
		try { next = pagination.querySelector(nextSelector); } catch (error) { return null; }
		if (!posts.length) return null;
		return {
			name: name,
			feedContainer: container,
			postSelector: postSelector,
			paginationContainer: pagination,
			nextLinkSelector: nextSelector,
			nextPageUrl: next && next.href ? next.href : null,
			posts: posts
		};
	}

	function manual(document, selectors) {
		if (!selectors || !selectors.feed || !selectors.post || !selectors.pagination || !selectors.next) return null;
		return result('manual', one(document, selectors.feed), selectors.post, one(document, selectors.pagination), selectors.next);
	}

	function p2(document) {
		return result('p2', one(document, '#postlist'), ':scope > li.post', one(document, '#main .navigation'), '.nav-older a');
	}

	function p2Resurrected(document) {
		return result('p2-resurrected', one(document, '#postlist'), ':scope > li.post', one(document, '#main .navigation'), 'a.next.page-numbers');
	}

	function kadence(document) {
		return result(
			'kadence',
			one(document, '#archive-container.kadence-posts-list'),
			':scope > li.entry-list-item',
			one(document, '#main > .navigation.pagination'),
			'a.next.page-numbers'
		);
	}

	function block(document) {
		var containers = document.querySelectorAll('.wp-block-query .wp-block-post-template');
		if (containers.length !== 1) return null;
		var query = containers[0].closest('.wp-block-query');
		if (!query) return null;
		var paginations = query.querySelectorAll('.wp-block-query-pagination');
		if (paginations.length !== 1) return null;
		return result('block', containers[0], ':scope > .wp-block-post', paginations[0], '.wp-block-query-pagination-next');
	}

	function generic(document) {
		var postSelector = ':scope > article.post, :scope > article.hentry, :scope > [id^="post-"]';
		var containerSelectors = ['.site-main', 'main', '.posts', '.post-list'];
		var candidates = [];

		containerSelectors.forEach(function (selector) {
			try {
				document.querySelectorAll(selector).forEach(function (container) {
					var posts = scopedPosts(container, postSelector);
					if (posts.length >= 1 && candidates.indexOf(container) === -1) candidates.push(container);
				});
			} catch (error) {}
		});

		if (candidates.length !== 1) return null;
		var container = candidates[0];
		var scope = container.closest('.site-content, .content-area') || container.parentElement || document;
		var navSelectors = ['.navigation', '.posts-navigation', '.pagination', '.nav-links'];
		var nextSelectors = ['.nav-previous a', '.nav-older a', 'a.next', 'a.next.page-numbers', 'a[rel="next"]'];
		var navCandidates = [];
		var detectedCandidates = [];

		for (var i = 0; i < navSelectors.length; i += 1) {
			var navs;
			try { navs = scope.querySelectorAll(navSelectors[i]); } catch (error) { continue; }
			for (var n = 0; n < navs.length; n += 1) {
				if (navCandidates.indexOf(navs[n]) === -1) navCandidates.push(navs[n]);
				for (var j = 0; j < nextSelectors.length; j += 1) {
					var detected = result('generic', container, postSelector, navs[n], nextSelectors[j]);
					if (detected && detected.nextPageUrl) {
						detectedCandidates.push(detected);
						break;
					}
				}
			}
		}
		if (detectedCandidates.length === 1) return detectedCandidates[0];
		if (detectedCandidates.length === 0 && navCandidates.length === 1) {
			return result('generic', container, postSelector, navCandidates[0], nextSelectors[0]);
		}
		return null;
	}

	function detect(document, config) {
		var detected = manual(document, config.selectors || {});
		if (detected) return detected;
		if (config.theme === 'p2') {
			return p2(document);
		}
		if (config.theme === 'p2-resurrected') {
			return p2Resurrected(document);
		}
		if (config.theme === 'kadence') {
			return kadence(document);
		}
		return block(document) || generic(document);
	}

	return {
		detect: detect,
		manual: manual,
		p2: p2,
		p2Resurrected: p2Resurrected,
		kadence: kadence,
		block: block,
		generic: generic,
		scopedPosts: scopedPosts
	};
}));
