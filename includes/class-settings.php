<?php
/**
 * Lightweight selector overrides for themes that cannot be detected safely.
 */

namespace HoldMyVodka\ProgressiveInfiniteScroll;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Settings {
	/** @var array<string,string> */
	private const FIELDS = array(
		'feed'       => 'Feed/container selector',
		'post'       => 'Individual post selector',
		'pagination' => 'Pagination container selector',
		'next'       => 'Next page link selector',
	);

	public static function init(): void {
		add_action( 'admin_init', array( self::class, 'register' ) );
		add_action( 'admin_menu', array( self::class, 'menu' ) );
	}

	public static function register(): void {
		register_setting(
			'wp_pfis',
			OPTION,
			array(
				'type'              => 'array',
				'default'           => array(),
				'sanitize_callback' => array( self::class, 'sanitize' ),
			)
		);

		add_settings_section(
			'wp_pfis_selectors',
			__( 'Theme compatibility selectors', 'wp-progressive-infinite-scroll' ),
			array( self::class, 'section' ),
			'wp_pfis'
		);

		foreach ( self::FIELDS as $key => $label ) {
			add_settings_field(
				'wp_pfis_' . $key,
				esc_html__( $label, 'wp-progressive-infinite-scroll' ),
				array( self::class, 'field' ),
				'wp_pfis',
				'wp_pfis_selectors',
				array( 'key' => $key )
			);
		}
	}

	public static function menu(): void {
		add_options_page(
			__( 'Progressive Infinite Scroll', 'wp-progressive-infinite-scroll' ),
			__( 'Infinite Scroll', 'wp-progressive-infinite-scroll' ),
			'manage_options',
			'wp-pfis',
			array( self::class, 'page' )
		);
	}

	/** @return array<string,string> */
	public static function get_selectors(): array {
		$value = get_option( OPTION, array() );
		return is_array( $value ) ? array_intersect_key( $value, self::FIELDS ) : array();
	}

	/** @param mixed $input @return array<string,string> */
	public static function sanitize( $input ): array {
		$output = array();
		if ( ! is_array( $input ) ) {
			return $output;
		}

		foreach ( self::FIELDS as $key => $_label ) {
			if ( empty( $input[ $key ] ) || ! is_string( $input[ $key ] ) ) {
				continue;
			}

			$value = trim( sanitize_text_field( wp_unslash( $input[ $key ] ) ) );
			$value = str_replace( array( '<', '>' ), '', $value );
			if ( '' !== $value ) {
				$output[ $key ] = substr( $value, 0, 250 );
			}
		}

		return $output;
	}

	public static function section(): void {
		echo '<p>' . esc_html__( 'Leave all fields blank for automatic P2, block-theme, or classic-theme detection. If used, provide all four selectors and test pagination carefully.', 'wp-progressive-infinite-scroll' ) . '</p>';
	}

	/** @param array{key:string} $args */
	public static function field( array $args ): void {
		$values = self::get_selectors();
		$key    = $args['key'];
		printf(
			'<input class="regular-text code" type="text" name="%1$s[%2$s]" value="%3$s" maxlength="250" autocomplete="off">',
			esc_attr( OPTION ),
			esc_attr( $key ),
			esc_attr( $values[ $key ] ?? '' )
		);
	}

	public static function page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Progressive Infinite Scroll', 'wp-progressive-infinite-scroll' ); ?></h1>
			<p><?php esc_html_e( 'The plugin changes no archive queries or pagination URLs. These optional selectors only help the browser identify existing theme markup.', 'wp-progressive-infinite-scroll' ); ?></p>
			<form action="options.php" method="post">
				<?php
				settings_fields( 'wp_pfis' );
				do_settings_sections( 'wp_pfis' );
				submit_button();
				?>
			</form>
		</div>
		<?php
	}
}

