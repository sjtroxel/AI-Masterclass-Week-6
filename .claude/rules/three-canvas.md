# Three.js / Orbital Canvas Rules — Asteroid Bonanza

## WSL2 / WebGL fallback (critical)
- `OrbitalCanvasComponent` MUST keep the Canvas 2D fallback — WebGL is unavailable in the WSL2 dev environment
- Never remove the Canvas 2D branch, even if WebGL detection looks correct
- Canvas 2D fallback pattern: `renderer = canvas.getContext('2d')` used when `WebGLRenderingContext` is unavailable
- This fallback has been needed and fixed before — do not regress it

## Angular lifecycle for canvas init
- Use `ngAfterViewInit` + `setTimeout(0)` to initialize the Three.js scene — NOT `afterNextRender`
- `afterNextRender` does not reliably fire after the canvas element is in the DOM in Angular 21
- Pattern:
  ```ts
  ngAfterViewInit() {
    setTimeout(() => this.initScene(), 0);
  }
  ```

## `@types/three` requirement
- `three@0.183.x` ships no `.d.ts` files — `@types/three` is required and must stay in `devDependencies`
- Do not remove `@types/three` or assume `three` ships its own types

## Three.js usage constraints
- OrbitalCanvasComponent is the only component that imports `three` — do not spread Three.js usage to other components
- Orbital math helpers (`orbit-math.ts`, `planet-positions.ts`) are pure functions with no Three.js dependency — keep them that way
- Mobile viewport (375px): use `OrthographicCamera` top-down view, limit to 5 asteroids
- Desktop viewport: use `PerspectiveCamera`, allow up to 20 asteroids

## OrbitControls
- Touch gestures: one-finger pan, pinch-to-zoom — required for mobile
- Scroll wheel: zoom on desktop
- Always test orbital canvas on both viewports after any Three.js changes

## Animation
- Apophis animated orbit: 1.5°/tick at 50ms interval — do not change timing without testing
- Cleanup: always call `renderer.dispose()` and cancel animation frames on component destroy via `DestroyRef`
