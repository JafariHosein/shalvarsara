# Design tokens — white & blue, dark-mode ready

shadcn/ui expects CSS variables in **HSL channel form** (`H S% L%`, no `hsl()` wrapper)
consumed by Tailwind via `hsl(var(--token))`. Keep that format.

Palette intent: a clean white canvas, a confident blue as the single accent, muted
cool greys for structure, and a deep navy-black for dark mode (not pure black).

## `src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 210 40% 99%;        /* near-white, faint blue tint   */
    --foreground: 222 47% 11%;        /* deep navy text                */

    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;

    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;

    --primary: 221 83% 53%;           /* #2563EB — brand blue          */
    --primary-foreground: 210 40% 98%;

    --secondary: 214 32% 95%;         /* pale blue-grey surface        */
    --secondary-foreground: 222 47% 11%;

    --muted: 214 32% 95%;
    --muted-foreground: 215 16% 47%;

    --accent: 214 95% 93%;            /* light blue hover              */
    --accent-foreground: 221 83% 40%;

    --destructive: 0 72% 51%;
    --destructive-foreground: 210 40% 98%;

    --success: 142 71% 35%;           /* in stock / paid               */
    --success-foreground: 0 0% 100%;

    --warning: 32 95% 44%;            /* low stock / pending           */
    --warning-foreground: 0 0% 100%;

    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 221 83% 53%;              /* focus ring = brand blue       */

    --radius: 0.75rem;

    /* charts (admin dashboard) */
    --chart-1: 221 83% 53%;
    --chart-2: 199 89% 48%;
    --chart-3: 262 83% 58%;
    --chart-4: 142 71% 45%;
    --chart-5: 32 95% 55%;
  }

  .dark {
    --background: 220 49% 8%;         /* #0B1220                       */
    --foreground: 210 40% 96%;

    --card: 220 40% 11%;
    --card-foreground: 210 40% 96%;

    --popover: 220 40% 11%;
    --popover-foreground: 210 40% 96%;

    --primary: 217 91% 60%;           /* slightly lighter blue on dark */
    --primary-foreground: 220 49% 8%;

    --secondary: 217 33% 17%;
    --secondary-foreground: 210 40% 96%;

    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 65%;

    --accent: 217 50% 22%;
    --accent-foreground: 210 40% 96%;

    --destructive: 0 63% 47%;
    --destructive-foreground: 210 40% 96%;

    --success: 142 60% 45%;
    --success-foreground: 220 49% 8%;

    --warning: 32 90% 55%;
    --warning-foreground: 220 49% 8%;

    --border: 217 33% 20%;
    --input: 217 33% 20%;
    --ring: 217 91% 60%;

    --chart-1: 217 91% 60%;
    --chart-2: 199 89% 55%;
    --chart-3: 262 83% 68%;
    --chart-4: 142 60% 50%;
    --chart-5: 32 90% 60%;
  }
}

@layer base {
  * { @apply border-border; }
  html { @apply h-full; }
  body {
    @apply min-h-full bg-background text-foreground antialiased;
    font-feature-settings: "ss01"; /* Vazirmatn stylistic set, optional */
  }
  /* Persian text benefits from slightly looser line-height */
  p, li { @apply leading-8; }
}
```

## `tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1280px" } },
    extend: {
      fontFamily: {
        sans: ["Vazirmatn Variable", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { "fade-in": "fade-in .35s ease-out both" },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

## Usage rules

- Surfaces: `bg-background` page, `bg-card` panels, `bg-muted` quiet areas, `bg-accent` hover.
- The brand blue is `bg-primary` / `text-primary`. Use it for **one** loud element per view (primary CTA, active state, price highlight). Everything else stays neutral.
- Status colours are semantic, not decorative: `success` = in stock / paid / delivered, `warning` = low stock / pending, `destructive` = out of stock / failed / cancel.
- Never use `text-white`/`text-black` directly — use `*-foreground` tokens so dark mode stays correct.
- Focus is always visible: rely on `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`.
