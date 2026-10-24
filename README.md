# London IT Support — particle site

A one-page site for [london-itsupport.co.uk](https://www.london-itsupport.co.uk/)
built on the same continuous dot animation as `particle-site`: a single cloud
of ~46,000 WebGL particles that morphs as you scroll.

| Section | The dots form |
| --- | --- |
| Hero | A large map of Greater London — all 33 boroughs, the Thames cut through them, and an amber ping on the office (labelled with its address) |
| 24/7 support | A clock face whose hands show the live time in London (amber second hand) |
| Cybersecurity | A shield and padlock with a scan line sweeping down it |
| Cloud services | A dotted globe with arcs from London to cloud regions worldwide, packets flying along them, and a dashed orbit |
| How we work (sticky, 3 pillars) | The reference site's DNA: a double helix spinning fast across the screen — faster while you scroll — and sliding along as the pillars change |
| Services (sticky slider) | The reference's closing beat: the same helix swings round to point at you and becomes a spinning vortex; each service sits in its mouth and every service is another turn |
| Case studies | Abstract, dim: a sea of dots — a lattice rippling under slow swells |
| Why choose us | Abstract, dim: a wireframe ring of dots turning, a ripple running round it |
| Testimonials | Abstract, dim: a slow three-armed spiral galaxy |
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

## The copy comes from the live site

`npm run sync` (`scripts/sync-content.mjs`) fetches the homepage, pulls out the
hero, about, values, services, case studies, assessment offer, testimonials,
FAQs and contact details, and writes them to
[`content/site.json`](content/site.json). `plugins/site-content.ts` renders
that file into `index.html` at build time, so the text is in the real HTML
(good for search and link previews). Nothing is fetched in the browser.

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

Section labels ("01 — Always on" etc.), button text and the nav live in
`index.html`; colours and fonts (Montserrat and Poppins, as on the live site)
in `src/style.css`; particle count, dot colour, accent and time zone in
`src/config.ts`.

## How it works

- **One draw call.** Every particle is a vertex in one `THREE.Points`. Each
  shape is another target position per particle; the vertex shader
  (`src/particles/shaders.ts`) blends between them with scroll-driven weights.
- **Shapes from drawings.** `src/particles/shapes.ts` draws the London map,
  clock dial and shield on a 2D canvas, then `sampler.ts` turns the drawings
  into points: grey level sets how many dots a pixel gets, and edges (the
  outer boundary and the Thames banks on the map) get extra, brighter dots so
  each shape reads as a crisp outline.
- **Globe.** Land and sea come from Natural Earth via `world-atlas`. Arc dots
  carry both ends of their arc; the shader flies them along the great circle
  between London and a cloud region, lifted off the surface mid-flight.
- **Procedural detail.** The office ping, clock hands, orbit and DNA are
  computed in the shader from per-particle seeds. The DNA is built along the
  x axis; its spin is integrated each frame (fast through "how we work", plus
  scroll speed), then it's turned a quarter turn about the vertical as you
  scroll into the services, so perspective turns it into a tunnel.
- **Backdrops.** Behind the reading sections the dots form abstract,
  slow-moving forms rather than pictures (sea, ring, galaxy, ribbon), all
  computed in the shader and shown dim (`uBackdropDim`: half brightness on
  desktop, a third on phones), with a light sprinkle of amber.
- **Attribute budget.** ANGLE on Direct3D (Chrome/Edge on Windows) and many
  phones refuse more than ~12 vertex attributes, so `ParticleField` keeps
  them few (the scatter origin rides in spare `w` slots). New shapes are
  best made procedural, like the backdrops.
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
