(function () {
	'use strict';

	var config = window.wpPFISConfig || {};
	var adapters = window.WPPFISAdapters;
	if (!adapters || !('IntersectionObserver' in window) || !('DOMParser' in window) || !('fetch' in window)) return;

	function debug(message, value) {
		if (config.debug && window.console) window.console.warn('[WP PFIS] ' + message, value || '');
	}

	function normalizeUrl(value) {
		if (typeof value !== 'string' || !value.trim()) return null;
		try {
			var url = new URL(value, window.location.href);
			url.hash = '';
			if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) return null;
			return url.href;
		} catch (error) {
			return null;
		}
	}

	function identity(post) {
		var match = (post.id || '').match(/(?:post|prologue)-(\d+)/);
		if (!match) match = (post.className || '').match(/(?:^|\s)post-(\d+)(?:\s|$)/);
		if (match) return 'post:' + match[1];
		var link = post.querySelector('a[rel~="bookmark"], a.thepermalink, a[href]');
		if (!link) return null;
		try {
			var url = new URL(link.href, window.location.href);
			url.hash = '';
			return 'url:' + url.href;
		} catch (error) {
			return null;
		}
	}

	function sourcePage(url) {
		var match = new URL(url).pathname.match(/\/page\/(\d+)\/?$/);
		if (match) return match[1];
		return new URL(url).searchParams.get('paged') || '1';
	}

	function init() {
		var adapter = adapters.detect(document, config);
		if (!adapter) {
			debug('No unambiguous compatible feed was detected.');
			return;
		}

		var feed = adapter.feedContainer;
		var pagination = adapter.paginationContainer;
		var nextUrl = normalizeUrl(adapter.nextPageUrl);
		if (!nextUrl || nextUrl === normalizeUrl(window.location.href)) return;

		var requested = new Set();
		var identities = new Set();
		var loading = false;
		var failed = false;
		var finished = false;
		var autoArmed = true;
		var controller = null;
		var requestHandler = function (url, options) { return window.fetch(url, options); };

		function refreshIdentities() {
			adapters.scopedPosts(feed, adapter.postSelector).forEach(function (post) {
				var id = identity(post);
				if (id) identities.add(id);
			});
		}
		refreshIdentities();

		feed.classList.add('wp-pfis-feed');
		pagination.classList.add('wp-pfis-pagination-fallback');

		var controls = document.createElement('div');
		controls.className = 'wp-pfis-controls';
		var loadMore = document.createElement('a');
		loadMore.className = 'wp-pfis-load-more';
		loadMore.href = nextUrl;
		loadMore.textContent = config.i18n.loadMore;
		var status = document.createElement('p');
		status.className = 'wp-pfis-status';
		status.setAttribute('role', 'status');
		status.setAttribute('aria-live', 'polite');
		status.setAttribute('aria-atomic', 'true');
		var sentinel = document.createElement('div');
		sentinel.className = 'wp-pfis-sentinel';
		sentinel.setAttribute('aria-hidden', 'true');
		controls.appendChild(loadMore);
		controls.appendChild(status);
		controls.appendChild(sentinel);
		pagination.insertAdjacentElement('beforebegin', controls);

		function setStatus(text) {
			status.textContent = text || '';
		}

		function fail(error) {
			loading = false;
			failed = true;
			loadMore.classList.remove('is-loading');
			loadMore.removeAttribute('aria-disabled');
			loadMore.textContent = config.i18n.continue;
			loadMore.href = nextUrl || loadMore.href;
			pagination.classList.add('is-prominent');
			setStatus(config.i18n.error);
			autoObserver.disconnect();
			debug('Loading stopped safely.', error);
		}

		function finish() {
			loading = false;
			finished = true;
			loadMore.remove();
			sentinel.remove();
			setStatus(config.i18n.noMore);
			autoObserver.disconnect();
		}

		function findFetchedAdapter(parsed) {
			var fetchedConfig = {
				theme: adapter.name === 'p2' || adapter.name === 'p2-resurrected' ? adapter.name : config.theme,
				selectors: adapter.name === 'manual' ? config.selectors : {}
			};
			var found = adapters.detect(parsed, fetchedConfig);
			return found && found.name === adapter.name ? found : null;
		}

		function reinitializeP2(posts) {
			if ((adapter.name !== 'p2' && adapter.name !== 'p2-resurrected') || !window.p2 || !window.p2.utility || typeof window.p2.utility.bindActions !== 'function') return;
			posts.forEach(function (post) {
				window.p2.utility.bindActions(post, 'post');
				post.querySelectorAll('li.comment').forEach(function (comment) {
					window.p2.utility.bindActions(comment, 'comment');
				});
				if (Array.isArray(window.postsOnPage) && post.id && window.postsOnPage.indexOf(post.id) === -1) {
					window.postsOnPage.push(post.id);
				}
			});
		}

		function updatePagination(fetched) {
			var imported = document.importNode(fetched.paginationContainer, true);
			pagination.replaceChildren.apply(pagination, Array.prototype.slice.call(imported.childNodes));
			pagination.classList.add('wp-pfis-pagination-fallback');
		}

		function appendPage(fetched, loadedUrl) {
			var fragment = document.createDocumentFragment();
			var marker = document.createElement(/^(UL|OL)$/.test(feed.tagName) ? 'li' : 'div');
			marker.className = 'wp-pfis-page-boundary';
			marker.hidden = true;
			marker.setAttribute('aria-hidden', 'true');
			marker.dataset.sourcePage = sourcePage(loadedUrl);
			marker.dataset.sourceUrl = loadedUrl;
			fragment.appendChild(marker);

			var added = [];
			fetched.posts.forEach(function (remotePost) {
				var post = document.importNode(remotePost, true);
				var id = identity(post);
				if (id && identities.has(id)) return;
				if (id) identities.add(id);
				post.dataset.sourcePage = sourcePage(loadedUrl);
				post.dataset.sourceUrl = loadedUrl;
				fragment.appendChild(post);
				added.push(post);
			});

			if (!added.length) throw new Error('The fetched page contained no new posts.');
			feed.appendChild(fragment);
			reinitializeP2(added);
			added.forEach(function (post) { historyObserver.observe(post); });
			document.dispatchEvent(new CustomEvent('wpFeedPostsAdded', {
				detail: { container: feed, posts: added, sourceUrl: loadedUrl }
			}));
			return added;
		}

		async function loadNext(source) {
			if (loading || finished || failed || !nextUrl || requested.has(nextUrl)) return;
			var loadedUrl = nextUrl;
			requested.add(loadedUrl);
			loading = true;
			loadMore.classList.add('is-loading');
			loadMore.setAttribute('aria-disabled', 'true');
			loadMore.textContent = config.i18n.loading;
			setStatus(config.i18n.loading);
			controller = new AbortController();
			var timer = window.setTimeout(function () { controller.abort(); }, Number(config.timeout) || 20000);

			try {
				var response = await requestHandler(loadedUrl, {
					credentials: 'same-origin',
					headers: { Accept: 'text/html' },
					signal: controller.signal
				});
				if (!response.ok) throw new Error('HTTP ' + response.status);
				var html = await response.text();
				var parsed = new DOMParser().parseFromString(html, 'text/html');
				var fetched = findFetchedAdapter(parsed);
				if (!fetched) throw new Error('The fetched archive markup is incompatible.');
				appendPage(fetched, loadedUrl);
				updatePagination(fetched);
				nextUrl = normalizeUrl(fetched.nextPageUrl);
				if (nextUrl && requested.has(nextUrl)) throw new Error('Pagination points to an already loaded page.');
				loading = false;
				loadMore.classList.remove('is-loading');
				loadMore.removeAttribute('aria-disabled');
				setStatus(config.i18n.loaded);

				if (!nextUrl) {
					finish();
				} else {
					loadMore.href = nextUrl;
					loadMore.textContent = config.i18n.loadMore;
				}
			} catch (error) {
				fail(error);
			} finally {
				window.clearTimeout(timer);
				controller = null;
				if (source === 'manual') autoArmed = false;
			}
		}

		loadMore.addEventListener('click', function (event) {
			if (failed) return;
			event.preventDefault();
			loadNext('manual');
		});

		var autoObserver = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (!entry.isIntersecting) {
					autoArmed = true;
				} else if (autoArmed && !loading && !failed && !finished) {
					autoArmed = false;
					loadNext('automatic');
				}
			});
		}, { rootMargin: config.rootMargin || '800px 0px' });

		var initialUrl = normalizeUrl(window.location.href);
		adapter.posts.forEach(function (post) {
			post.dataset.sourcePage = sourcePage(initialUrl);
			post.dataset.sourceUrl = initialUrl;
		});
		var historyObserver = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (!entry.isIntersecting || !entry.target.dataset.sourceUrl) return;
				var url = normalizeUrl(entry.target.dataset.sourceUrl);
				if (url && url !== normalizeUrl(window.location.href)) window.history.replaceState(window.history.state, '', url);
			});
		}, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
		adapter.posts.forEach(function (post, index) { if (index === 0) historyObserver.observe(post); });

		// Feed-scoped integration: programmatic searches are not manual button taps.
		window.WPPFIS = {
			container: feed,
			loadNext: function () { return loadNext('unseen'); },
			setRequestHandler: function (handler) {
				if (typeof handler === 'function') requestHandler = handler;
			}
		};
		autoObserver.observe(sentinel);
		document.documentElement.classList.add('wp-pfis-active');
		document.dispatchEvent(new CustomEvent('wpFeedInfiniteScrollReady', { detail: { adapter: adapter.name, container: feed } }));
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
	else init();
}());
