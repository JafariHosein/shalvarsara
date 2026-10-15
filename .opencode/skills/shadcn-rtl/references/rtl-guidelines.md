# RTL guidelines (Persian)

The app is RTL by default. Write layouts so they would *also* work in LTR — that is
the test that you used logical properties instead of physical ones.

## Physical vs logical

| Don't (physical) | Do (logical) |
| --- | --- |
| `ml-2` / `mr-2` | `ms-2` / `me-2` |
| `pl-4` / `pr-4` | `ps-4` / `pe-4` |
| `left-0` / `right-0` | `start-0` / `end-0` |
| `inset-x-…` on one side | `start-…` / `end-…` |
| `text-left` / `text-right` | `text-start` / `text-end` |
| `border-l` / `border-r` | `border-s` / `border-e` |
| `rounded-l-lg` / `rounded-r-lg` | `rounded-s-lg` / `rounded-e-lg` |
| `rounded-tl` / `rounded-br` | `rounded-ss` / `rounded-ee` |
| `origin-left` | `origin-start` (or `rtl:origin-right`) |
| `space-x-4` | `flex gap-4` |
| `divide-x` | `divide-x divide-x-reverse`, or borders |

Tailwind v3.3+ ships `ps/pe/ms/me/start/end/text-start/text-end/border-s/border-e/rounded-s/rounded-e`
and the `rtl:` / `ltr:` variants. Use them.

## Prefer flex/grid over directional margin

```tsx
// ✅ direction-agnostic
<div className="flex items-center gap-3">
  <Avatar />
  <span>نام کاربر</span>
</div>

// ❌ breaks or needs a reverse hack
<div className="flex">
  <Avatar className="mr-3" />
</div>
```

Use `justify-between` + `gap` for rows; avoid `space-x-*` entirely.

## Icons that must mirror

Directional icons should point the way the language reads. Apply `rtl:-scale-x-100`
on the icon, or pick the opposite glyph:

| Icon | RTL meaning | Treatment |
| --- | --- | --- |
| `ChevronRight` (pagination "next", breadcrumb) | next / forward | `rtl:-scale-x-100` |
| `ArrowRight` (link "continue") | forward | `rtl:-scale-x-100` |
| `ChevronLeft` (drawer close, "back") | back | `rtl:-scale-x-100` |
| `LogOut`, `Undo`, `Reply` | — | `rtl:-scale-x-100` |
| `Search`, `Cart`, `Heart`, `Star`, `Plus`, `Minus` | no direction | leave as-is |

```tsx
<ChevronRight className="size-4 rtl:-scale-x-100" />
```

Do **not** mirror non-directional icons, logos, or media playback controls.

## Floating UI and overlays

- Radix reads direction from `DirectionProvider` (set in `main.tsx`). If you use a primitive
  outside the provider (a portal in a test, a storybook), pass `dir="rtl"` explicitly.
- `Sheet` / `Dialog` slide directions: `side="right"` is the natural side for a cart drawer in
  RTL — but decide by reading order, not screen side. Persian users expect the cart drawer to
  open from the **left** edge (the "end" side). Use the `end` side and confirm visually.
- `DropdownMenu`, `Select`, `Tooltip`, `Popover`, `ContextMenu` all position correctly with RTL
  once direction is provided. Verify menus are not clipped by `overflow-hidden` ancestors.

## Charts and inherently-LTR widgets

- Recharts/shadcn `Chart` render LTR axes. Wrap in `<div dir="ltr">` and keep labels Persian.
- Toasts (`sonner`) should be placed `position="top-center"` or `bottom-center` — side toasts
  fight with RTL reading.
- Numeric inputs (phone, postal code, national ID, IBAN, card) and OTP fields: `<Input dir="ltr"
  className="text-start" />` so digits type left-to-right, then Persian-label them.
- Phone: accept `۰۹…` and `09…`, normalize with `toEnDigits` before sending.

## Scrollbars, truncation, ordering

- Native scrollbars follow `dir` automatically; custom scrollbar styles should not assume side.
- `truncate` works fine; for multi-line use `line-clamp-*`.
- Flex order stays logical; if you need "reverse" *visual* order in RTL, use `flex-row-reverse`
  deliberately (e.g. price above cover) rather than physical positioning.

## Keyboard and accessibility

- Logical focus order is DOM order; do not reorder visually with `flex-row-reverse` if it breaks
  tab order.
- Every interactive control keeps `focus-visible:ring-2 ring-ring`.
- Respect motion: gate entrances with `motion-safe:animate-fade-in` and never animate layout
  indefinitely.
- `aria-label`s and `alt` text are Persian.

## RTL review checklist

- [ ] No `ml/mr/pl/pr/left/right/text-left/text-right` used for layout.
- [ ] No `space-x-*` without `space-x-reverse`.
- [ ] Directional icons mirrored.
- [ ] Dropdowns/selects/tooltips open fully on-screen (not clipped).
- [ ] Cart drawer and mobile nav open from the correct (end) side.
- [ ] Numeric/OTP fields are `dir="ltr"` with visible Persian label.
- [ ] Charts wrapped in `dir="ltr"`.
- [ ] Tab order matches visual order.
