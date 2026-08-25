<?php
/**
 * Plugin Name:       WP Progressive Infinite Scroll
 * Plugin URI:        https://github.com/ilyavish/wp-progressive-infinite-scroll
 * Description:       Adds theme-aware infinite scrolling while preserving normal WordPress pagination as the foundation and fallback.
 * Version:           1.0.2
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            holdmyvodka.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wp-progressive-infinite-scroll
 */

namespace HoldMyVodka\ProgressiveInfiniteScroll;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const VERSION = '1.0.2';
const OPTION  = 'wp_pfis_selectors';

require_once __DIR__ . '/includes/class-settings.php';

/**
 * Whether the current request can receive the progressive enhancement.
 */
function is_supported_view(): bool {
	$supported = ! is_admin() && ( is_home() || is_archive() || is_search() );

	/**
	 * Filters whether assets should be loaded for the current front-end request.
	 *
	 * The initial page and its pagination are always rendered by the theme.
	 *
	 * @param bool $supported Whether the current request is supported.
	 */
	return (bool) apply_filters( 'wp_pfis_is_supported_view', $supported );
}

/**
 * Enqueue the small, dependency-free enhancement assets.
 */
function enqueue_assets(): void {
	if ( ! is_supported_view() ) {
		return;
	}

	$theme    = wp_get_theme();
	$template = strtolower( (string) $theme->get_template() );
	$style    = strtolower( (string) $theme->get_stylesheet() );
	$settings = Settings::get_selectors();
	$theme_id = 'generic';

	if ( 'p2' === $template || 'p2' === $style ) {
		$theme_id = 'p2';
	} elseif ( 'p2-resurrected' === $template || 'p2-resurrected' === $style ) {
		$theme_id = 'p2-resurrected';
	} elseif ( 'kadence' === $template || 'kadence' === $style ) {
		$theme_id = 'kadence';
	}

	wp_enqueue_style(
		'wp-pfis',
		plugins_url( 'assets/css/infinite-scroll.css', __FILE__ ),
		array(),
		VERSION
	);

	wp_enqueue_script(
		'wp-pfis-adapters',
		plugins_url( 'assets/js/adapters.js', __FILE__ ),
		array(),
		VERSION,
		true
	);

	wp_enqueue_script(
		'wp-pfis',
		plugins_url( 'assets/js/infinite-scroll.js', __FILE__ ),
		array( 'wp-pfis-adapters' ),
		VERSION,
		true
	);

	$config = array(
		'theme'      => $theme_id,
		'selectors'  => $settings,
		'rootMargin' => '800px 0px',
		'timeout'    => 20000,
		'debug'      => defined( 'WP_DEBUG' ) && WP_DEBUG && current_user_can( 'manage_options' ),
		'i18n'       => array(
			'loadMore'       => __( 'Load more', 'wp-progressive-infinite-scroll' ),
			'loading'        => __( 'Loading more posts…', 'wp-progressive-infinite-scroll' ),
			'loaded'         => __( 'More posts loaded.', 'wp-progressive-infinite-scroll' ),
			'continue'       => __( 'Continue to the next page', 'wp-progressive-infinite-scroll' ),
			'error'          => __( 'Automatic loading paused. Use the next-page link to continue.', 'wp-progressive-infinite-scroll' ),
			'noMore'         => __( 'No more posts.', 'wp-progressive-infinite-scroll' ),
			'incompatible'   => __( 'Infinite scrolling is unavailable for this layout.', 'wp-progressive-infinite-scroll' ),
		),
	);

	/**
	 * Filters the public JavaScript configuration.
	 *
	 * @param array<string,mixed> $config Configuration values.
	 */
	$config = apply_filters( 'wp_pfis_script_config', $config );

	wp_add_inline_script(
		'wp-pfis',
		'window.wpPFISConfig = ' . wp_json_encode( $config ) . ';',
		'before'
	);
}
add_action( 'wp_enqueue_scripts', __NAMESPACE__ . '\\enqueue_assets', 100 );

/**
 * Load translations and admin settings.
 */
function bootstrap(): void {
	load_plugin_textdomain( 'wp-progressive-infinite-scroll', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );

	if ( is_admin() ) {
		Settings::init();
	}
}
add_action( 'plugins_loaded', __NAMESPACE__ . '\\bootstrap' );
