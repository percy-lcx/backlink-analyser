# Frontend - React + Vite

TypeScript React dashboard for visualizing backlink data.

## Stack

React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, Recharts, TanStack Table, React Router.

## Structure

- `src/lib/api.ts` - API client with typed fetch wrappers and all interface definitions
- `src/lib/metrics.ts` - Derived metric calculations and tooltip text
- `src/components/` - UI components, plus `charts/` and `tables/` subdirectories
- `src/components/ProfileContext.tsx` - React context for selected profile state
- `src/App.tsx` - Root component with tab-based layout and route definitions

## Commands

```
npm run dev       # Vite dev server on :5173
npm run build     # tsc -b && vite build
npm run lint      # ESLint
```

## Patterns

- Vite proxies `/api/*` to `http://localhost:8000` (see `vite.config.ts`)
- `api.ts` is the single point for all backend calls - add new endpoints there
- Charts use Recharts; tables use TanStack Table via the `DataTable.tsx` wrapper
- Profile selection flows through `ProfileContext`
- Strict TypeScript: `noUnusedLocals` and `noUnusedParameters` enabled
- ESLint config in `eslint.config.js` (flat config format)
