# Prime Trade Exchange — Design System

## Brand Identity
Prime Trade Exchange is a wholesale electronics and accessories business. The design language is modern, clean, and trustworthy — inspired by Linear, Stripe, and Vercel.

## Colors

### Primary — Deep Blue
| Token | Hex | Usage |
|-------|-----|-------|
| brand-50 | #f0f7ff | Light backgrounds, hover states |
| brand-100 | #e0efff | Selected states, active filters |
| brand-200 | #b8dbff | Borders on active elements |
| brand-300 | #7abfff | — |
| brand-400 | #3a9eff | Links |
| brand-500 | #0a7aef | Primary buttons, active states |
| brand-600 | #0062cc | Button hover |
| brand-700 | #004fa6 | Header background, primary accent |
| brand-800 | #003d80 | Dark accents |
| brand-900 | #0a2540 | Primary text |
| brand-950 | #061729 | Darkest text |

### Accent — Teal
| Token | Hex | Usage |
|-------|-----|-------|
| teal-500 | #0d9488 | Secondary highlights, received/success states |
| teal-600 | #0f766e | Hover state |

### Surfaces
| Token | Hex | Usage |
|-------|-----|-------|
| surface-0 | #ffffff | Cards, modals |
| surface-50 | #f8fafc | Page background |
| surface-100 | #f1f5f9 | Secondary backgrounds |
| surface-200 | #e2e8f0 | Borders, dividers |

### Status Colors
| Token | Hex | Usage |
|-------|-----|-------|
| status-green | #16a34a | No discrepancy (0 units short) |
| status-yellow | #ca8a04 | Low discrepancy (1-5 units short) |
| status-red | #dc2626 | High discrepancy (6+ units short), alerts only |

**Rule: Red is reserved strictly for discrepancies and error states. Never use red for decorative purposes.**

## Typography

**Font Family:** Inter (Google Fonts)
- Fallback: system-ui, -apple-system, sans-serif

**Monospace:** JetBrains Mono
- Fallback: Fira Code, monospace

### Scale
| Name | Size | Weight | Usage |
|------|------|--------|-------|
| Metric | 2.25rem (36px) | 700 | Dashboard summary numbers |
| Page Title | 1.5rem (24px) | 700 | Page headings |
| Section Header | 1.125rem (18px) | 600 | Card/section titles |
| Body | 0.875rem (14px) | 400 | Table cells, descriptions |
| Label | 0.75rem (12px) | 500-600 | Card labels, table headers (uppercase, tracking-wider) |
| Small | 0.6875rem (11px) | 400 | Timestamps, footnotes |

## Spacing

Base unit: 4px. Use Tailwind's default spacing scale.

| Token | Value | Usage |
|-------|-------|-------|
| p-4 | 16px | Standard card padding |
| p-6 | 24px | Large card padding |
| gap-4 | 16px | Grid gaps |
| gap-6 | 24px | Section spacing |
| mb-8 | 32px | Section margins |

## Components

### Cards
```
bg-surface-0 rounded-[0.75rem] shadow-card p-6
hover: shadow-card-hover transition-shadow duration-200
```

### Buttons — Primary
```
bg-brand-500 text-white px-4 py-2 rounded-lg font-medium text-sm
hover: bg-brand-600
```

### Buttons — Secondary
```
bg-surface-100 text-brand-900 px-4 py-2 rounded-lg font-medium text-sm border border-surface-200
hover: bg-surface-200
```

### Quick Filter Pills
```
Active:   bg-brand-700 text-white px-3 py-1.5 rounded-full text-xs font-medium
Inactive: bg-surface-100 text-slate-600 px-3 py-1.5 rounded-full text-xs font-medium
hover:    bg-surface-200
```

### Status Badges
```
None (green):  bg-green-50 text-status-green px-2 py-0.5 rounded-full text-xs font-medium
Low (yellow):  bg-yellow-50 text-status-yellow px-2 py-0.5 rounded-full text-xs font-medium
High (red):    bg-red-50 text-status-red px-2 py-0.5 rounded-full text-xs font-semibold
```

### Tables
```
Header: text-xs font-semibold uppercase tracking-wider text-slate-500 bg-surface-50 px-4 py-3
Cell:   text-sm text-brand-900 px-4 py-3 border-b border-surface-200
Row hover: hover:bg-brand-50/50
```

## Shadows
| Token | Value | Usage |
|-------|-------|-------|
| shadow-card | 0 1px 3px rgb(0 0 0/0.04) | Default card shadow |
| shadow-card-hover | 0 4px 6px rgb(0 0 0/0.06) | Hover/interactive state |

## Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| rounded-card (0.75rem) | 12px | Cards, panels |
| rounded-lg | 8px | Buttons, inputs |
| rounded-full | 9999px | Badges, pills |
