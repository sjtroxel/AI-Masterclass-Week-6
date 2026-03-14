# TypeScript Rules — Asteroid Bonanza

## Module system
- Use NodeNext module resolution everywhere (`"module": "NodeNext"`, `"moduleResolution": "NodeNext"`)
- All relative imports must include the `.js` extension, even in `.ts` files (e.g., `import { Foo } from './foo.js'`)
- Never omit the extension — NodeNext will not resolve extensionless imports

## Compiler strictness
- `"strict": true` is non-negotiable and must never be disabled
- No `@ts-ignore` or `@ts-expect-error` without a comment explaining why
- `noUncheckedIndexedAccess: true` — array/object access always returns `T | undefined`

## Type discipline
- No `any`. Ever. Use `unknown` and narrow it.
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use type predicates and `satisfies` rather than casting with `as`
- Cast with `as` only when TypeScript cannot infer something it logically should — always add a comment
- Use `.d.ts` files for types shared across workspaces (not `.ts`) to prevent rootDir expansion

## Shared types
- All cross-workspace types live in `shared/types.d.ts`
- Never duplicate a type that already exists in `shared/`
- Agent output interfaces, SwarmState, confidence score shapes, and API response types are all shared types

## Naming
- `PascalCase` for types, interfaces, classes, enums
- `camelCase` for variables, functions, methods
- `SCREAMING_SNAKE_CASE` for true constants (env values, magic numbers)
- Files: `kebab-case.ts` for most files; `PascalCase.ts` for Angular components (Angular CLI convention)
