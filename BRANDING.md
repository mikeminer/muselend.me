# muselend.me — brand assets

The canonical assets live in `public/brand/`. Use `muselend-logo.svg` on light
backgrounds and `muselend-logo-dark.svg` on dark backgrounds. The standalone
mark is `muselend-icon.svg`.

## Palette

| Token | Value | Usage |
| --- | --- | --- |
| Brand purple | `#7F77DD` | Primary actions, emphasis, gradient start |
| Lending teal | `#5DCAA5` | Positive states, DeFi accent, gradient end |
| Ink | `#211F2D` | Text on light backgrounds |
| Night | `#1A1826` | Dark backgrounds |

Recommended CSS tokens:

```css
:root {
  --brand-purple: #7f77dd;
  --brand-teal: #5dcaa5;
  --brand-gradient: linear-gradient(135deg, var(--brand-purple), var(--brand-teal));
  --brand-ink: #211f2d;
  --brand-night: #1a1826;
}
```

## Usage

- Keep clear space around the logo equal to at least one quarter of the icon width.
- Do not recolor, distort, rotate, or rearrange the mark.
- Use the SVG assets wherever possible; raster favicons are provided for browsers and PWA installs.
- Use the accessible name `muselend.me` and tagline `Creator Token Lending`.

Add these elements to the site document head when the application is created:

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#7F77DD">
```
