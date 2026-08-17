# WP Progressive Infinite Scroll

A standalone, theme-aware WordPress plugin built for holdmyvodka.com. It preserves ordinary WordPress pagination and adds infinite scrolling only as a progressive enhancement.

## Architecture

The PHP layer only decides whether the current request is a feed/archive/search, identifies P2, loads the two small native-JavaScript files and CSS, and exposes optional selector settings. It does not change `WP_Query`, rewrite URLs, add REST routes, start sessions, or vary server output by visitor.

`assets/js/adapters.js` normalizes supported theme markup into:

* `feedContainer`
* `postSelector`
* `paginationContainer`
* `nextLinkSelector`
* `nextPageUrl`

`assets/js/infinite-scroll.js` is the theme-independent engine. It observes one sentinel, fetches one real archive page at a time, parses it with `DOMParser`, imports only detected post nodes through a `DocumentFragment`, updates the existing fallback pagination, and advances to the next real URL found in that response.

## Adapters

### P2

The adapter was based on inspection of the official P2 source:

* feed: `#postlist`
* posts: direct `li.post` children, with `prologue-{ID}` identities
* pagination: `#main .navigation`
* older/next link: `.nav-older a`

P2's `p2.js` binds actions to posts and comments during its initial setup and polls separately for newly published posts. After older posts are appended, the plugin calls the existing public `p2.utility.bindActions()` function for each new post and its comments, and updates P2's public `postsOnPage` array when available. It does not rerun `p2.initialize()`, which would duplicate handlers, and it does not interfere with P2's newest-post polling.

### Block themes

Exactly one `.wp-block-query .wp-block-post-template` is required. Direct `.wp-block-post` children are appended and `.wp-block-query-pagination-next` provides the URL. Multiple query loops are treated as ambiguous and left untouched.

### Classic themes

The generic adapter looks for an unambiguous direct-post stream in common containers such as `.site-main`, `main`, `.posts`, and `.post-list`. Posts must be direct `article.post`, `article.hentry`, or `[id^="post-"]` children. Pagination is sought only in the surrounding content scope. Ambiguity causes a safe no-op.

### Manual selectors

Settings > Infinite Scroll accepts feed, post, pagination, and next-link selectors. All four must resolve safely. Invalid or ambiguous selectors cause a no-op; they never lead to arbitrary appends.

## Runtime behavior

The initial page remains completely server-rendered. An `IntersectionObserver` with an `800px 0px` root margin watches a one-pixel sentinel. Automatic loading is re-armed only after the sentinel leaves the intersection area, preventing a short page from recursively pulling the entire archive. The same `loadNext()` function powers the real-href Load More control.

Only same-origin HTTP(S) URLs obtained from pagination are accepted. A `Set` prevents repeated URLs, one request may run at a time, and an `AbortController` stops a request after 20 seconds. No future pages or images are preloaded.

Post identities prefer `post-{ID}`, `prologue-{ID}`, or a `post-{ID}` class, then fall back to a normalized permalink. Duplicate nodes are skipped. Fetched scripts are never inserted or executed.

Each appended post receives `data-source-page` and `data-source-url`; a hidden, container-valid page-boundary element is also inserted. A conservative visibility observer calls `history.replaceState()` as page sections enter the reading band. Refreshing or copying that URL opens a real paginated archive; no Back-button entry is added for each automatic load.

After an append, the plugin dispatches:

```js
document.dispatchEvent(new CustomEvent('wpFeedPostsAdded', {
    detail: {
        container: feedContainer,
        posts: addedPosts,
        sourceUrl: loadedUrl
    }
}));
```

Seen/Unseen behavior is intentionally outside this plugin.

## Pagination, accessibility, and failures

The theme's pagination is never removed. JavaScript adds a Load More anchor whose `href` is the same real next-page URL. The original pagination is only visually de-emphasized; it stays visible, focusable, and crawlable. A polite live region announces state without moving focus.

On HTTP, timeout, parsing, selector, duplicate-page, or malformed-markup failure, automatic observation stops. The original navigation becomes prominent and the manual control becomes an ordinary “Continue to the next page” link. With JavaScript disabled, none of the plugin markup exists and the theme behaves normally.

## SEO and performance

Canonical tags, robots directives, sitemaps, permalinks, archive queries, and paginated URLs are untouched. Search engines and non-JavaScript visitors receive the same server-rendered archive and crawlable links.

There are no external libraries, extra database queries, visitor state, custom endpoints, or cache bypasses. Initial rendering and LCP are not blocked. Appends are batched, existing lazy-loading attributes are preserved, only requested pages are fetched, and reduced-motion preferences are respected.

## Compatibility notes

Automatic mode intentionally does not guess when a page has multiple matching Query blocks, multiple candidate classic feeds, posts nested in an unknown wrapper, JavaScript-rendered-only pagination, or a pagination control whose next link cannot be identified. Use manual selectors for these themes. Infinite scroll also requires modern browser support for `IntersectionObserver`, `fetch`, `DOMParser`, `AbortController`, and `CustomEvent`; ordinary pagination is the fallback elsewhere.

## Manual testing checklist

- [ ] P2: first page detects `#postlist`; appended reply/edit controls work for the current user.
- [ ] Classic theme: one direct article stream is detected; unrelated articles are not appended.
- [ ] Block theme: one Query loop appends direct `.wp-block-post` items.
- [ ] JavaScript disabled: page 1 and visible pagination behave exactly as the theme normally does.
- [ ] Follow `/page/2/` and `/page/3/` directly with JavaScript disabled.
- [ ] Automatic loading begins near the bottom and loads only one page at a time.
- [ ] Manual Load More triggers the same behavior and remains keyboard operable.
- [ ] Load at least three consecutive pages; verify order and page-source data attributes.
- [ ] Verify no duplicate post IDs or permalinks are appended.
- [ ] Simulate offline/500/timeout; verify the real continuation link and original pagination remain usable.
- [ ] Reach the final page; verify “No more posts” and no further requests.
- [ ] Scroll between page sections and check conservative URL replacement.
- [ ] Use Back/Forward, refresh, copy the current URL, and open an individual post.
- [ ] Open a direct `/page/3/` visit and verify loading continues from its real older link.
- [ ] Test narrow mobile layouts and touch interaction.
- [ ] Navigate controls and pagination using only the keyboard; confirm focus never jumps.
- [ ] Check status announcements with VoiceOver/NVDA and inspect landmarks/link names.
- [ ] Throttle to Slow 3G; verify one request, stable existing content, and usable fallback.
- [ ] Run PageSpeed/Lighthouse before and after; inspect LCP, CLS, INP, and request waterfall.
- [ ] Confirm WordPress lazy-loading attributes remain on appended images.
- [ ] Test an unsupported/ambiguous theme; verify it safely retains normal pagination.

## Development

```bash
npm install
npm test
find . -name '*.php' -exec php -l {} \;
```
