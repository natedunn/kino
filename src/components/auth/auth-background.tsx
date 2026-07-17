/**
 * Full-bleed auth backdrop: a subtle grayscale mesh gradient (two corner points)
 * with a fine noise grain on top. Pure grayscale — points use the theme
 * `--foreground` at low alpha via color-mix, so it never introduces hue.
 * Light and dark use separate alpha (the gradient is inline CSS, so we toggle
 * two layers with `dark:` visibility) — light needs a stronger mix to read on
 * a near-white background. Decorative only (aria-hidden, non-interactive).
 */

// Two soft grayscale points — top-right and bottom-left of the viewport.
function mesh(alpha: string) {
	return [
		`radial-gradient(at 100% 0%, color-mix(in oklch, var(--foreground) ${alpha}, transparent) 0px, transparent 55%)`,
		`radial-gradient(at 0% 100%, color-mix(in oklch, var(--foreground) ${alpha}, transparent) 0px, transparent 55%)`,
	].join(', ');
}

const MESH_LIGHT = mesh('15%');
const MESH_DARK = mesh('7%');

// A small tileable fractal-noise SVG (grayscale). `%23` = #, `%25` = %.
// numOctaves=2 keeps the grain visually indistinguishable from 3 here while
// roughly halving the one-time feTurbulence raster cost on low-end mobile.
const NOISE_SVG =
	"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function AuthBackground() {
	return (
		<div aria-hidden className='pointer-events-none fixed inset-0 z-0'>
			<div className='absolute inset-0 bg-background' />
			<div className='absolute inset-0 dark:hidden' style={{ backgroundImage: MESH_LIGHT }} />
			<div className='absolute inset-0 hidden dark:block' style={{ backgroundImage: MESH_DARK }} />
			<div
				className='absolute inset-0 opacity-[0.12] mix-blend-soft-light dark:opacity-[0.10]'
				style={{ backgroundImage: NOISE_SVG, backgroundRepeat: 'repeat' }}
			/>
		</div>
	);
}
