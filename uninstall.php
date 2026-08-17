<?php
/**
 * Remove only this plugin's small selector option on uninstall.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'wp_pfis_selectors' );

