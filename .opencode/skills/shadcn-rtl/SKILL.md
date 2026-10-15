---
name: shadcn-rtl
description: >-
  Standards for the Persian, RTL, white-and-blue storefront built with React +
  Vite + shadcn/ui + Tailwind. Use when styling, theming, composing components,
  wiring dark mode, laying out RTL pages, or formatting Persian numbers, dates,
  and prices in this project.
---

# shadcn/ui + RTL (Persian storefront)

This project is a **Persian, right-to-left (RTL)** e-commerce frontend:
React + Vite + TypeScript + Tailwind CSS v3.4 + shadcn/ui (Radix primitives).
The visual theme is **white and blue** with a full **dark mode**.

Load these references as needed:

- `references/design-tokens.md` — the exact CSS variables for light/dark and the blue palette.
- `references/rtl-guidelines.md` — RTL layout rules, logical properties, mirrored icons.
- `references/component-recipes.md` — project component patterns (product card, price, size/color pickers, cart drawer, admin table).
- `references/persian-content.md` — Persian numbers, currency, Jalali dates, and copy conventions.

## Non-negotiable ground rules

1. **Direction is RTL everywhere.** `<html lang="fa" dir="rtl">` is set once. Never hardcode `left`/`right` for layout — use logical utilities (see `rtl-guidelines.md`).
2. **Never hardcode colors.** Use semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border-border`, `ring-ring`). Raw palette classes like `bg-blue-600` or `bg-slate-900` are only allowed inside the token definitions in `globals.css` and in one-off data visualizations.
3. **Dark mode is class-based.** `darkMode: ["class"]` in `tailwind.config`; the theme is toggled by adding/removing `dark` on `<html>`. Every new surface must be checked in both modes.
4. **Compose, don't fork.** Add shadcn components with the CLI (`npx shadcn@latest add <name>`) and extend them with `cva` variants rather than editing `components/ui/*` unless a change is truly global.
5. **Buttons and links must be RTL-aware.** Icons that imply direction (chevrons, arrows, back) are mirrored (see below).
6. **All user-facing text is Persian**, sentence case, no English left in the UI, and prices/dates/numbers render in Persian digits.

## Setup (once per app)

```bash
# 1. Base
npm create vite@latest . -- --template react-ts
npm i -D tailwindcss@^3.4 postcss autoprefixer @types/node
npx tailwindcss init -p

# 2. shadcn
npx shadcn@latest init
npx shadcn@latest add button card input label select dialog sheet dropdown-menu \
  tabs badge sonner skeleton tooltip accordion table alert-dialog switch \
  textarea avatar separator checkbox radio-group slider pagination

# 3. RTL direction provider (Radix) + Persian font
npm i @radix-ui/react-direction @fontsource-variable/vazirmatn
```

Wire it up:

```tsx
// src/main.tsx
import "@fontsource-variable/vazirmatn";
import { DirectionProvider } from "@radix-ui/react-direction";

root.render(
  <DirectionProvider dir="rtl">
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </DirectionProvider>,
);
```

```html
<!-- index.html -->
<html lang="fa" dir="rtl" class="h-full">
```

`@` must resolve to `src` in both `tsconfig.json` (`paths`) and `vite.config.ts` (`resolve.alias`), otherwise `shadcn add` imports break.

## Theme and dark mode

Apply the tokens from `references/design-tokens.md` to `src/index.css`. Provide a theme provider that:

- reads `localStorage.theme`, falls back to `prefers-color-scheme`,
- toggles the `dark` class on `document.documentElement`,
- exposes `useTheme()` with `{ theme, setTheme }`,
- includes an inline no-flash script in `index.html` that sets `dark` before paint.

```tsx
// blocks flash of wrong theme; runs before React
<script dangerouslySetInnerHTML={{ __html: `
  (function(){var t=localStorage.getItem('theme');
  var d=t?t==='dark':matchMedia('(prefers-color-scheme:dark)').matches;
  document.documentElement.classList.toggle('dark',d);})();
` }} />
```

## RTL quick rules

- Layout: `flex`, `grid`, `gap-*`. Avoid `space-x-*` (it needs `space-x-reverse` in RTL).
- Spacing/positioning: `ps-4`/`pe-4`, `ms-2`/`me-2`, `start-0`/`end-0`, `text-start`/`text-end`.
- Borders/radius: `border-s`, `border-e`, `rounded-s-lg`, `rounded-e-lg`.
- Mirror direction icons: `rtl:-scale-x-100` or swap the icon (`ChevronLeft` ↔ `ChevronRight`, `ArrowRight` ↔ `ArrowLeft`).
- Floating UI (Select, DropdownMenu, Tooltip, Popover): pass `dir="rtl"` on the primitive, or rely on `DirectionProvider`.
- Wrap charts and any inherently-LTR widget (media timelines, code, phone/IBAN fields) in `<div dir="ltr">`.

Full details and a checklist are in `references/rtl-guidelines.md`.

## Formatter utilities (use these, not ad-hoc formatting)

```ts
// src/lib/format.ts
const fa = (n: number, opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat("fa-IR", opts).format(n);

export const formatToman = (amount: number) => `${fa(amount)} تومان`;
export const formatNumber = (n: number) => fa(n);
export const formatDate = (d: Date | string) =>
  new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(d));
export const toFaDigits = (s: string | number) =>
  String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
export const toEnDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
   .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
```

Amounts travel through the app in **Toman as integers** (no floats). Convert to Rial only at the ZarinPal boundary.

## When you finish a UI change, verify

- [ ] Renders correctly in **light and dark**.
- [ ] Layout reads naturally **right-to-left** (no mirrored-but-broken flex, no clipped dropdowns).
- [ ] Numbers, prices, and dates show **Persian digits**.
- [ ] Keyboard focus is visible (`ring-ring`) and `prefers-reduced-motion` is respected.
- [ ] Responsive from 360px up; mobile uses `Sheet` drawers instead of sidebars.
- [ ] No hardcoded colors and no leftover English strings.
