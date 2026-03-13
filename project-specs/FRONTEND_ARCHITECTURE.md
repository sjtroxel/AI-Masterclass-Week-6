# Asteroid Bonanza — Frontend Architecture

*Angular 21 component structure, signals pattern, design system, and feature slices.*

**Mobile-first is a core requirement, not an afterthought.** Every layout decision, component, and feature must be designed for mobile first, then enhanced for desktop. Lessons from Strawberry Star: late-stage mobile retrofitting is painful and produces worse results than building mobile-first from day one.

---

## Mobile-First Strategy

### The rule

Design and build every component starting at the smallest viewport (375px / iPhone SE). Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`) to *add* complexity at larger sizes — never to *fix* broken layouts.

### Responsive breakpoints

| Breakpoint | Min-width | Target devices |
|---|---|---|
| (base) | 0px | Mobile portrait — design target |
| `sm:` | 640px | Mobile landscape, small tablets |
| `md:` | 768px | Tablets, large phones landscape |
| `lg:` | 1024px | Laptops, desktop |
| `xl:` | 1280px | Large desktop |

### Layout approach per feature

| Feature | Mobile | Desktop |
|---|---|---|
| Asteroid Search | Full-width card list, single column | Grid (2–3 col), sidebar filters |
| Asteroid Dossier | Stacked sections, swipeable tabs for Orbital/Composition/Risk/Economics | Multi-panel layout, all sections visible |
| Swarm Analysis | Sequential card reveal (one agent at a time) | Side-by-side agent panels with live progress |
| Analyst Chat | Full-screen overlay, slide-up drawer | Slide-in sidebar panel |
| Defense Watch | Stacked PHA list + Apophis highlight | Dashboard grid |
| Three.js View | Simplified top-down 2D-ish scene (see below) | Full 3D perspective scene |

### Navigation

- Mobile: Bottom navigation bar (search, dossier, analysis, analyst, defense)
- Desktop: Left sidebar navigation
- Angular router handles deep links on both — no layout-specific routing

### Touch considerations

- All interactive targets minimum 44×44px (Apple HIG standard)
- Swipe gestures for tab navigation on the asteroid dossier
- Long press not used (not discoverable on mobile)
- Three.js canvas: pinch-to-zoom and drag-to-pan on touch

---

## Angular 21 Signals Architecture

All local component state uses Angular signals (`signal()`, `computed()`, `effect()`). RxJS is used only where it genuinely improves things: HTTP via `HttpClient` (which returns Observables), and the SSE `EventSource` wrapper.

No NgRx, NgXS, or other state management library. Signals are sufficient for the complexity level of this application.

---

## Feature Slice Structure

Each feature directory contains its own components, services, and route configuration:

```
features/
├── asteroid-search/
│   ├── asteroid-search.component.ts
│   ├── asteroid-search.service.ts
│   ├── asteroid-card.component.ts       # Mobile: full-width card; Desktop: grid card
│   └── routes.ts
├── asteroid-detail/
│   ├── asteroid-detail.component.ts
│   ├── dossier-tabs.component.ts        # Mobile: tab nav; Desktop: all panels visible
│   ├── dossier-section.component.ts    # Orbital, Composition, Economics, Risk panels
│   ├── orbital-canvas.component.ts     # Three.js wrapper (Phase 6)
│   └── routes.ts
├── analysis/
│   ├── analysis-panel.component.ts     # The swarm analysis interface
│   ├── agent-progress.component.ts     # Real-time agent status display
│   ├── confidence-display.component.ts # Visual confidence score breakdown
│   ├── handoff-banner.component.ts     # Human handoff alert
│   └── routes.ts
├── analyst-chat/
│   ├── analyst-sidebar.component.ts    # Desktop: slide-in panel; Mobile: full-screen overlay
│   ├── analyst.service.ts              # EventSource management
│   └── routes.ts
└── defense-watch/
    ├── defense-dashboard.component.ts
    ├── pha-list.component.ts
    ├── apophis-feature.component.ts    # Apophis 2029 featured case study
    └── routes.ts
```

---

## Global API Client

`core/api.service.ts` — A typed Angular service that wraps all `HttpClient` calls with proper error handling and typed return values. Components never call `HttpClient` directly. This is the Angular equivalent of the typed `api.ts` client from Poster Pilot.

---

## Tailwind v4 Design Tokens

`src/styles/globals.css` defines the design system:

```css
@import "tailwindcss";

@theme {
  /* Space-appropriate dark palette */
  --color-void: #050811;          /* Near-black space background */
  --color-nebula: #0d1b2e;        /* Panel backgrounds */
  --color-stellar: #1a3a5c;       /* Card surfaces */
  --color-ion: #3d7ab5;           /* Primary interactive */
  --color-plasma: #7bb8e8;        /* Highlights */
  --color-gold: #f0b429;          /* Economic value highlights — the "bonanza" color */
  --color-hazard: #e05252;        /* Planetary defense / danger */
  --color-safe: #52c47a;          /* Confirmed safe / positive */

  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

Dark-first design. The application is space-themed — deep backgrounds, accent colors that evoke mineral wealth and orbital mechanics. The "bonanza" gold color is used consistently for economic value indicators.

---

## `.postcssrc.json`

Required for Tailwind v4 to function with Angular's esbuild pipeline. `postcss.config.js` is silently ignored.

```json
{
  "plugins": {
    "@tailwindcss/postcss": {}
  }
}
```

---

## UI/UX Design Principles

- **Mobile-first always**: Build at 375px, enhance upward. Never fix mobile at the end.
- **Dark-first**: The void of space is the default. Light mode is not planned.
- **Data density (scaled by viewport)**: On desktop, dossier panels are side-by-side. On mobile, they stack and tab — same data, appropriate density for screen size.
- **Progressive disclosure**: The swarm analysis panel reveals results as agents complete — not all at once after a long wait. This works especially well on mobile where vertical scroll is natural.
- **Confidence transparency**: Confidence scores are always visible alongside AI-generated content, not hidden.
- **Handoff clarity**: When a handoff is triggered, the UI makes it unmistakably clear that this result needs expert review — on any screen size.
- **Source attribution**: The Analyst sidebar always shows source labels (science vs. scenario) on cited content.

---

## Three.js Orbital Visualization

Planned for Phase 6. The user has prior Three.js experience (stars in Strawberry Star). The solar system canvas will live as `orbital-canvas.component.ts` inside the `asteroid-detail` feature.

### Desktop behavior
- Full 3D perspective scene: Sun at center, inner planets (Mercury–Mars), NEO orbits as ellipses
- Mouse orbit controls (drag to rotate, scroll to zoom)
- Clickable asteroid objects deep-linking to dossier
- Orbit highlighted when viewing a specific asteroid
- Close approach animation for selected dates

### Mobile behavior
- **Not desktop-only.** A simplified but presentable mobile version is a requirement.
- Orthographic camera locked to top-down view (eliminates 3D disorientation on small screens)
- Touch controls: pinch-to-zoom, one-finger drag to pan
- Fewer simultaneous orbits displayed (show current asteroid + nearest neighbors by approach, not all 35k)
- Larger tap targets on asteroid objects (minimum 44px touch zone, even if visual dot is smaller)
- If the scene genuinely cannot be made presentable at 375px, a 2D SVG orbital diagram is the fallback — same data, simpler renderer, still interactive

### Implementation notes
- Orbits are drawn from stored orbital elements — not physics-simulated
- No new data sources needed; `semi_major_axis_au`, `eccentricity`, `inclination_deg` already in the database
- Planet positions use a simplified Kepler approximation or pre-computed lookup table — exact positions are not the point
- See `08-build-phases.md` for full Phase 6 scope and stretch goals

---

*Document created: 2026-03-13*
