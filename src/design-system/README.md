# Storyloop design tokens

This directory is the shared visual foundation for Storyloop Admin, Homepage, Creator and Company surfaces.

## Source of truth

- `tokens.ts` contains the shipped Storyloop defaults.
- `theme.ts` resolves typed runtime overrides and converts resolved values to CSS custom properties.
- Dark is the default theme. Light is an override.

## Editable vs code-controlled

Brand settings may override approved token groups at runtime:

- colors
- gradient
- typography
- font weights
- radius
- spacing
- default theme

Navigation, layouts, permissions, workflow states, page hierarchy and business logic remain code-controlled.

Runtime overrides should eventually be loaded from Storyloop company configuration in Supabase. The database must store non-secret configuration only. Defaults remain in code so the product always has a deterministic fallback.

## Typography

- Montserrat: display, titles and body.
- Exo 2 Bold: system labels, eyebrows, stats, micro-copy and uppercase labels.

Do not introduce another UI font without an explicit product decision.
