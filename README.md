# London IT Support — particle site

A one-page site for [london-itsupport.co.uk](https://www.london-itsupport.co.uk/)
built on the same continuous dot animation as `particle-site`: a single cloud
of ~46,000 WebGL particles that morphs as you scroll.

| Section | The dots form |
| --- | --- |
| Hero | A large map of Greater London — all 33 boroughs, the Thames cut through them, and an amber ping on the office (labelled with its address) |
| 24/7 support | Silk: a full-width band of fine dotted lines along the bottom of the screen, rolling in slow swells that never stop, crests catching the light, amber glints running along a few lines and a sparse drift of soft amber specks. The copy (and the live London time) sits above it |
| Cybersecurity | Abstract: a dotted crystal — an icosahedron around a smaller one turning the other way and a soft core — with a faint amber scan passing through |
| Cloud services | A dotted globe with arcs from London to cloud regions worldwide, packets flying along them, and a dashed orbit |
| How we work (one screen, 3 pillars side by side) | Silk narrowed to a ribbon, twisting as it flows across the open band above the pillars |
| Services (sticky slider) | A wide silk sheet low on the screen that takes a different form for each service: calm swells, ripples from the centre, a rising crest, a twisting sheet, pleated folds, a saddle. It flows from one form into the next as you scroll |
| Case studies | Abstract, dim: a sea of dots — a lattice rippling under slow swells |
| Why choose us | Abstract, dim: a wireframe ring of dots turning, a ripple running round it |
| Testimonials | Abstract, dim: a slow three-armed spiral galaxy that swirls round a third, brightening, with each new quote |
| FAQs | Abstract, dim: a ribbon of dotted threads drifting and twisting |
| Contact | The London map again, beside the contact details, with the office ping |

Vite + TypeScript + Three.js + Lenis. No framework.

```bash
npm install
npm run dev     # http://127.0.0.1:5182
npm run sync    # refresh the copy from london-itsupport.co.uk
npm run build   # sync (soft) + type-check + production build in dist/
```

Add `?skip-intro` to the URL to skip the preloader and intro while designing.

## Intro

1. **Preloader** — the London IT Support logo (`src/assets/logo.svg`) draws
   itself left to right: each letter traces its outline then fills, and the
   amber N drops into place. The two rules beside "IT SUPPORT" are the
   progress bar, growing outward (`--progress`, set by
   `src/effects/preloader.ts`).
2. **Dissolve** — the drawn logo turns into dots where it stands: the dots
   sit exactly under it (both come from the same SVG) and fade in, each at
   its own moment, as the drawn logo fades out. The N and the rules stay
   amber.
3. **Scatter** — the dots drift apart a little, with depth: most stay close
   so "London IT" still reads, and a few stray further.
4. **Into the map** — the dots flow on into the London map, and the page
   fades in.

Timings are `config.intro` in `src/config.ts`. Reduced-motion visitors skip
straight to the map.

A few inline styles in `index.html`'s head make the preloader cover the page
from the very first paint (and keep its logo hidden until it can draw), so
the raw page never flashes up before `style.css` arrives — which in dev is
only once the script has loaded. `style.css` sets `--styled` to say it's in.

The SVG's letters carry `data-letter` (numbered left to right), which
staggers the draw. "IT SUPPORT" is split into one path per letter for this;
it looks the same as the original single path.

## Components

The reusable sections are components, written into any page with a tag:

```html
{{> header}}
{{> enquiry id="contact-form" title="Talk to us"}}
{{> footer}}
```

Each lives in `src/components/<name>/`:
- `<name>.template.ts` renders its HTML from the synced content at build
  time (in Node; `plugins/components.ts` registers it and expands the tags).
- `<name>.css` styles it.
- `<name>.ts`, if it has one, wires it up in the browser. `initComponents()`
  in `src/components/index.ts` finds every instance on the page.

| Component | What it is | Props |
| --- | --- | --- |
| `header` | London IT Support's own menu, synced from its site, laid out like intouchtech.co.uk's: a floating bar with mega-menu dropdowns (hover, click or keyboard, one open at a time), a "Contact us" button and the theme switch. Each dropdown item has an icon: intouchtech.co.uk's own menu icons in the accent colour, plus a SIM card and handset drawn to match (`plugins/menu-icons.ts`, matched by label; an item with no match gets its group's icon). Below 1100px it becomes a full-screen menu. | `home` (logo and Home link, default `#top`), `contact` (button target, default `#enquiry`) |
| `enquiry` | The banner form from the live site, step for step (synced), as a frosted-glass pane beside the contact details as tall labelled rows: a "01 / 03" counter on hairline segments, underline fields, chip checkboxes, each step checked before moving on. | `id` (unique per page; also prefixes the field ids, default `enquiry`), `title`, `partners="true"` to add the partner logos |
| `footer` | As on london-itsupport.co.uk (always navy): logo, strapline, contact details, the synced link columns and legal links. | `home` |
| `accreditations` | The live site's banner certification badges in a quiet row, hairlines between them. CREST, Pen Test and Vonahi show white on the dark page (as the live site whitens them) and inked on the light one; the Cyber Essentials badges keep their own colours. | `only` (keys, default all but ISO), `label` |
| `partners` | The logo strip after the live site's banner (Cyber Essentials, Microsoft 365, Dell, Fortinet) as one-colour marks, sized by eye. | `label` |
| `head` | The `<head>`: meta, the theme script, the inline styles that stop the raw page flashing up, fonts. | `title`, `description` (default: the page's synced meta) |
| `faq` | The FAQ accordion. | none (the home page's synced FAQs) |
| `page-hero` | An inner page's opening: breadcrumb (Home / menu group / page), the synced H1, subtitle and buttons, and the accreditation badges, with the enquiry form on the right (`renderEnquiryForm`, the form on its own). | none |
| `testimonials` | The synced testimonials as a showcase: one quote at a time, large on a glass stage, its words rising in, with an outlined quote mark and a glow that follows the cursor. The people are listed beside it (a row of chips on phones). The current person's timer fills, then it moves on; it holds while hovered, keyboard-focused or off screen, or with the pause button. Prev/next, swiping and the arrow keys also move it, and each change turns the galaxy of dots behind it on a third (`TESTIMONIAL_EVENT`, `uGalaxySpin`). Reduced motion: no timer. | none (section `#voices`) |
| `page-sections` | An inner page's synced sections, in order, each through its own component (below). | none |

The section components that `page-sections` uses (each also takes the
section's tagline, title and lead):

| Section | What it is |
| --- | --- |
| `intro` | The opening statement, with any short points beside it. |
| `benefits` | A ticked list of what's included. |
| `cards` | A grid of cards (2, 3 or 4 across, as on the live page). A card whose title matches a menu item links to that page. |
| `process` | Numbered steps, each a small ring on one hairline (a vertical line on phones). |
| `stats` | Big figures with their units. |
| `plans` | Packages and prices as glass cards with ticked features. |
| `cta` | A glass call-to-action band with its buttons (and ticked list, if any). Buttons with no words around them are a plain centred row. |
| `prose` | Long copy: headings, paragraphs and lists, as written. |
| `faq` | That page's own FAQs, through the `faq` component. |
| `partners` | "Our partners", through the `partners` component. |

The home page uses the enquiry form twice: after the banner (with the
partner logos) and at the bottom, after the free-assessment offer, whose
button now goes to it.

**A new page** is an `.html` file in the project root — every one is built.
Use the components, and `<script type="module" src="/src/site.ts">` for the
shared styles and behaviour (the home page's `src/main.ts` adds the particles
on top). Page-only copy uses `{{placeholders}}` filled in
`plugins/site-content.ts`. The live site's own pages don't need this — see
Pages.

**Forms:** set `VITE_FORM_ENDPOINT` in `.env` (see `.env.example`) to POST
answers to a form service such as Formspree or Web3Forms. Without it, "Send
enquiry" opens the visitor's email app with the answers filled in, addressed
to the site's email.

**Logos** load from the live site's own image host (the URLs come with the
sync), so they stay in step with it. The London IT Support logo SVG is inlined
at build time, so its letters take the text colour (white on the dark page,
navy on the light one) and the N stays amber (`.logo__n`).

**Width:** text, the menu and the footer are at most 1400px wide, centred
(`--content-max` in `src/style.css`, via `--gutter`); the particles stay full
screen. The page uses the normal mouse pointer.

## Pages

Every other page in the live site's sitemap (20 of them: the services, about,
contact, privacy policy) is built from its synced copy, at the same path:
`/managed-it-support/`, `/leased-lines/` and so on.

- `npm run sync` saves each page to `content/pages/<slug>.json`: its meta, hero
  and sections. `scripts/pages.mjs` reads the live page's Webflow sections and
  names each by its inner classes (FAQ, timeline → `process`, numbers →
  `stats`, pricing → `plans`, a ticked list → `benefits`, card grids →
  `cards`); "Our partners" becomes `partners`, short copy with buttons a
  `cta`, and anything else `prose`. A page that's dropped from the sitemap
  has its file removed.
- All of them share one template, `src/pages/page.html`: header, `page-hero`,
  `page-sections`, the enquiry form and the footer. There's no `.html` file per
  page — `plugins/site-content.ts` serves each slug from the template in dev
  and adds it to the build.
- Links to the live site are made local wherever there's a local page: the
  menu, the footer, buttons and cards. "Contact us" buttons go to the form at
  the bottom of the page (`#contact-form`).
- The banner (`page-hero`) has the enquiry form on the right (stacked below
  the copy under 1000px), as well as the full enquiry section at the bottom.
- `src/page.ts` runs them: smooth scrolling, sections that rise in as they
  arrive, and the dot sea (the home page's case-studies backdrop) across the
  lower half of the screen behind it all. It leans toward the cursor, dots
  near the cursor warm to amber, and it dims as you scroll into the copy.

The copy is the live site's, as it stands: the IT services page's H1 reads
"Backup & Disaster Recovery Solutions in London", and the broadband page's
FTTC tab lists the same FTTP plans as its FTTP tab (shown once here).

**A new section type** (if the live site adds a kind of section that comes
through as `prose`): add a rule to `RULES` in `scripts/pages.mjs`, the type to
`PageSection` in `plugins/types.ts`, and a component in `src/components/`
that `page-sections` maps it to.

## The copy comes from the live site

`npm run sync` (`scripts/sync-content.mjs`) fetches the homepage, pulls out the
navbar menu, hero, banner badges, partner logos, enquiry form, about, values,
services, case studies, assessment offer, testimonials, FAQs, contact details
and footer, and writes them to
[`content/site.json`](content/site.json). `plugins/site-content.ts` renders
that file into the pages at build time, so the text is in the real HTML
(good for search and link previews). No copy is fetched in the browser.

- The snapshot is committed, so builds work offline. `npm run build` re-syncs
  first; if the site can't be reached it keeps the existing snapshot and says so.
- The scraper follows the Webflow class names on the live page. If the site is
  restructured, `npm run sync` stops with the missing selector instead of
  writing half-empty content — update the selector in `extract()`.
- While `npm run dev` is running, a sync reloads the open page.
- `SITE_URL=https://staging… npm run sync` reads another copy of the page.

Which value or service each particle panel features is matched by keyword in
`plugins/site-content.ts` (`/24\/7|support/`, `/cyber|secur/`, `/cloud/`), so
the site can reorder its cards. The two values shown in panels aren't repeated
in the "Why choose" grid.

The office pin on the map comes from the site too: the plugin reads the
coordinates out of the footer's Google Maps link.

## The London map

[`src/data/london.json`](src/data/london.json) holds the 33 borough
boundaries from the ONS Open Geography Portal (Local Authority Districts, May
2024, "BGC": generalised to 20 m and clipped to the coastline, which is what
cuts the tidal Thames out as a gap). `npm run fetch-london` re-downloads and
re-bakes it; it's projected and normalised at that point, so the browser does
no geo maths. It's Open Government Licence data — keep the attribution in the
footer.

Section labels ("01 — Always on" etc.) and button text live in
`index.html`; colours and fonts (Montserrat and Poppins, as on the live site)
in `src/style.css`; particle count, dot colours, accent and time zone in
`src/config.ts`.

## Dark, mix and light

Three themes, picked with the switch in the top bar (moon · half circle ·
sun) and remembered (`localStorage`, key `theme`). New visitors get **mix**.
The head component's inline script applies the theme before first paint, so
there's no flash.

- **Mix** sits between the other two. The dark sections use London IT's navy
  (`#001b41`, lighter than dark's near-black) and carry the dots. The
  reading sections are floating cards of frosted light glass: brightest at
  the top left and warming to amber at the far corner like the site's other
  glass, with a fine white rim and a soft shadow. They're mostly opaque (84–94%)
  so the dots show faintly through, at most 1120px wide (78% of the screen,
  90% at 991px and below; `--sheet-width`), with room around them so the
  dots show there too. Light sections side by side are separate cards. Grey
  and amber text are darker on the cards to stay legible (5:1 or better), and
  the backdrops behind them are dimmed less than in dark mode
  (`config.looks.mix.behindSheet`). They don't simply alternate. On the home
  page: the map, a light card (the banner form), navy "Who are we?" and the
  particle run (24/7 to services), light case studies, navy core values and
  testimonials, a light FAQ, the navy contact map, and the light form. The
  inner pages' banner form stays dark glass.
- A section is light in mix with `data-tone="light"`:
  - in `index.html` for the home page's own sections;
  - always on the enquiry and FAQ components;
  - by type on the synced pages (`LIGHT_IN_MIX` in
    `src/components/shared/shared.template.ts`: intro, benefits, prose,
    partners). Cards, steps, figures, prices and calls to action stay navy.

  Only a section (a child of `<main>`) becomes a card; anything else marked
  light just takes the light colours.
- Page colours are tokens on `:root` in `src/style.css`, overridden under
  `:root[data-theme='light']`, which also applies inside mix's light cards.
  Amber text uses `--accent-text`, a darker amber on light backgrounds so it
  stays legible; amber fills keep `--accent`. A rule written for the light
  theme needs `:root[data-theme='mix'] [data-tone='light']` beside it to
  apply on the cards too (see the partner logos).
- The dots differ per theme in `config.looks`: on the dark page they're pale
  and drawn additively (they add light); on the light page they're navy and
  laid on like ink — additive dots would vanish on white. `behindText` dims
  dots that sit behind copy a little more in light mode, where ink reads
  heavier. Mix draws them as on the dark page, a little brighter for the
  navy; its light cards mostly cover them.

## How it works

- **One draw call.** Every particle is a vertex in one `THREE.Points`. Each
  shape is another target position per particle; the vertex shader
  (`src/particles/shaders.ts`) blends between them with scroll-driven weights.
- **Shapes from drawings.** `src/particles/shapes.ts` draws the London map
  and the intro logo on a 2D canvas, then `sampler.ts` turns the drawings
  into points: grey level sets how many dots a pixel gets, and edges (the
  outer boundary and the Thames banks on the map) get extra, brighter dots so
  each shape reads as a crisp outline.
- **Globe.** Land and sea come from Natural Earth via `world-atlas`. Arc dots
  carry both ends of their arc; the shader flies them along the great circle
  between London and a cloud region, lifted off the surface mid-flight.
- **Procedural detail.** The office ping, the silks and the globe's orbit
  are computed in the shader from per-particle seeds; the crystal is built
  on the CPU (icosahedron edges, vertices, faces, inner crystal, core).
- **Silk.** The site's visual language (after a reference image supplied
  for the project): one `silk()` function in the shader, a sheet of rows
  of dots rolling in swells, and every silk shape is that sheet with other
  parameters: swell height and frequency, ripples from the centre, twist,
  pleats, saddle, a rising crest, and narrowing into a ribbon. It only reads
  as silk when its rows are packed tight, so the sheets are shallow bands,
  and phones (half the dots) get fewer rows (`uSilk`). The services forms
  are listed in `config.serviceSilk`; each holds while its service is up
  and flows into the next at the change-over. `main.ts` measures the open
  band above the pillars to place the "how we work" ribbon.
- **Backdrops.** Behind the reading sections the dots form abstract,
  slow-moving forms rather than pictures (sea, ring, galaxy, ribbon), all
  computed in the shader and shown dim (`uBackdropDim`: half brightness on
  desktop, a third on phones), with a light sprinkle of amber.
- **Attribute budget.** ANGLE on Direct3D (Chrome/Edge on Windows) and many
  phones refuse more than ~12 vertex attributes, so `ParticleField` keeps
  them few (brightness and flags ride in spare `w` slots). New shapes are
  best made procedural, like the backdrops.
- **Canvas size, not `innerWidth`.** Anything that maps screen positions to
  the particles (the intro logo, the map pin, the pointer) uses the canvas's
  own size (`field.screen`). `innerWidth` includes the scrollbar, which on
  Windows shifts things by ~15px.
- **Coherent morphs.** Every cloud is sorted top-to-bottom, so particle *i*
  travels to a nearby spot in the next shape instead of across the screen.
- **Scroll mapping.** `src/main.ts` reads each section's position every frame:
  a shape morphs in as its section rises from the bottom of the screen to near
  the top. Fast scrolling adds turbulence.
- **Performance and accessibility.** Touch devices get half the particles and a
  capped pixel ratio. `prefers-reduced-motion` skips the intro, smooth
  scrolling, turbulence and hover effects.

## Credits

Copy, contact details and case studies: London IT Support
([london-itsupport.co.uk](https://www.london-itsupport.co.uk/)). London
boundaries: contains National Statistics data © Crown copyright and database
right 2024; contains OS data © Crown copyright and database right 2024 (Open
Government Licence). World map: [Natural Earth](https://www.naturalearthdata.com/)
(public domain), via `world-atlas`. Effects inspired by
[ingrassiadaniel.it](https://ingrassiadaniel.it/), written from scratch. Fonts:
Montserrat and Poppins (Google Fonts, OFL).
