// The contents of every page's <head>: title and description (the page's own
// from the live site, else the home page's), the share image (public/og-image.png,
// from london-itsupport.co.uk), the theme before first paint, the fonts, and a
// guard against the raw page flashing up.
// shortcut: og:image URL is absolute to london-it.vercel.app, change it if the site moves domain.
//
//   <head>{{> head}}</head>
//
// Props: title, description — to override.
import type { ComponentContext, Props } from '../../../plugins/components';
import { escapeHtml } from '../../../plugins/html';

export default function head({ content, page }: ComponentContext, props: Props): string {
  const title = escapeHtml(props.title ?? page?.meta.title ?? content.meta.title);
  const description = escapeHtml(props.description ?? page?.meta.description ?? content.meta.description);
  return `<meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://london-it.vercel.app/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#001b41" />
    <script>
      // Theme before first paint, so there's no flash: a saved choice, else mix.
      (function () {
        var theme;
        try {
          theme = localStorage.getItem('theme');
        } catch (e) {}
        if (theme !== 'dark' && theme !== 'light') theme = 'mix';
        document.documentElement.dataset.theme = theme;
      })();
    </script>
    <style>
      /* Until the stylesheet arrives (in dev it's injected by the script) the
         page shows only its background, never the raw markup. style.css sets
         --styled. Kept low in specificity so style.css overrides it. */
      html {
        background: #001b41;
      }
      html:where([data-theme='dark']) {
        background: #000c20;
      }
      html:where([data-theme='light']) {
        background: #f3f5fa;
      }
      body {
        opacity: var(--styled, 0);
      }
    </style>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&family=Poppins:wght@400;500&display=swap"
      rel="stylesheet"
    />`;
}
