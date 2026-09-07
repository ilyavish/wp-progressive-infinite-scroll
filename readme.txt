=== WP Progressive Infinite Scroll ===
Contributors: ilyavish
Tags: infinite scroll, pagination, progressive enhancement, p2, accessibility
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Theme-aware infinite scrolling that keeps real WordPress pagination fully functional.

== Description ==

WP Progressive Infinite Scroll fetches the active theme's existing paginated archive HTML and appends its original post elements. It does not add an endpoint, modify archive queries, replace server rendering, or remove pagination.

Built-in adapters cover:

* P2 (`#postlist`, direct `li.post`, `.navigation`, `.nav-older a`)
* P2 Resurrected (`#postlist`, direct `li.post`, numbered pagination, `a.next.page-numbers`)
* Kadence and Kadence child themes (`#archive-container`, complete card list items, numbered pagination)
* Block Query loops
* Unambiguous common classic-theme markup
* Complete manual selector overrides under Settings > Infinite Scroll

The original pagination remains in the document and a real, keyboard-accessible next-page link is added as a manual Load More control. If loading fails, that link navigates to the ordinary paginated URL.

== Installation ==

1. Upload the `wp-progressive-infinite-scroll` folder to `/wp-content/plugins/` or upload the release ZIP in Plugins > Add New.
2. Activate the plugin.
3. Visit a home, archive, or search feed with at least two pages.
4. P2 requires no settings. For an unsupported theme, configure all four selectors under Settings > Infinite Scroll.

== Frequently Asked Questions ==

= Does this remove pagination? =

No. Pagination stays server-rendered, crawlable, keyboard accessible, and directly usable without JavaScript.

= Does it use the REST API? =

No. It fetches the real next archive page, parses it without executing scripts, and imports the theme's post elements.

= How can another plugin initialize appended content? =

Listen for `wpFeedPostsAdded` on `document`. Event detail contains `container`, `posts`, and `sourceUrl`.

= Why does nothing happen on my theme? =

Ambiguous detection fails safely. Configure precise selectors in Settings > Infinite Scroll; the normal pagination continues working meanwhile.

== Changelog ==

= 1.0.4 =
* Recheck the bottom marker after requests finish, including triggers received during loading.
* Continue automatically after manual loads when the marker remains nearby. Limit consecutive automatic requests to three until the marker leaves or the reader clicks again.

= 1.0.3 =
* Expose a feed-scoped loading API and response provider. Programmatic unseen searches no longer disable automatic loading as manual clicks do.

* Add automatic Kadence and Kadence child-theme detection.
* Preserve Kadence's complete `li.entry-list-item` card wrapper when appending its archive grid.


= 1.0.1 =

* Add automatic P2 Resurrected detection and its numbered older-post pagination markup.
* Apply the controlled P2 post/comment reinitialization to P2 Resurrected appends.

= 1.0.0 =

* Initial release with P2, block-theme, classic-theme, and manual adapters.
* Add automatic and manual loading, request safeguards, duplicate prevention, conservative history updates, accessible status messages, and failure fallback.
