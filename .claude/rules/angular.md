# Angular Rules — Asteroid Bonanza

## Signal-first reactivity
- Use Angular signals (`signal()`, `computed()`, `effect()`) for all reactive state
- Do not use RxJS Subjects or BehaviorSubjects for component state — signals only
- RxJS is permitted only at HTTP boundaries (`HttpClient` returns `Observable`) — convert immediately to signals with `toSignal()` or an async effect
- No NgRx, no NGXS, no other state management library

## Component structure
- Feature slice layout: `features/<feature-name>/` containing components, a service (if needed), and types
- Shared/dumb components live in `shared/components/`
- Each component: one `.ts` file with inline template (prefer) or a paired `.html` for complex templates
- One component per file — no multi-component files

## HTTP / services
- All HTTP calls go through a single `api.service.ts` in `core/`
- No component may call `HttpClient` directly — always via `api.service.ts`
- `api.service.ts` is the only file that knows the base URL and sets headers

## Templates
- **Mobile template written first, always.** The base template is 375px. Desktop enhancements are layered on top with `md:` and `lg:` Tailwind breakpoints.
- Every interactive element needs a minimum 44×44px touch target (Tailwind: `min-h-[44px] min-w-[44px]`)
- Bottom nav bar on mobile (`block md:hidden`), sidebar on desktop (`hidden md:block`)
- No inline styles — Tailwind utility classes only

## Routing
- Use standalone components with `provideRouter`
- Lazy-load all feature routes
- Route-level code splitting is not optional

## Lifecycle
- Prefer `DestroyRef` and `takeUntilDestroyed()` over manual unsubscribe patterns
- Use `OnPush` change detection on all components — default ChangeDetectionStrategy is not acceptable
