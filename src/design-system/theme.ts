import {
  defaultTheme,
  storyloopTokens,
  type StoryloopTokens,
  type ThemeName,
} from "./tokens";

export type EditableStoryloopTokens = Partial<{
  colors: Partial<StoryloopTokens["colors"]>;
  gradient: Partial<StoryloopTokens["gradient"]>;
  typography: Partial<StoryloopTokens["typography"]>;
  radius: Partial<StoryloopTokens["radius"]>;
  spacing: StoryloopTokens["spacing"];
}>;

export type StoryloopThemeConfig = {
  defaultTheme?: ThemeName;
  dark?: EditableStoryloopTokens;
  light?: EditableStoryloopTokens;
};

function mergeTokens(
  base: StoryloopTokens,
  overrides?: EditableStoryloopTokens,
): StoryloopTokens {
  if (!overrides) return base;

  return {
    colors: { ...base.colors, ...overrides.colors },
    gradient: { ...base.gradient, ...overrides.gradient },
    typography: { ...base.typography, ...overrides.typography },
    radius: { ...base.radius, ...overrides.radius },
    spacing: overrides.spacing ?? base.spacing,
  };
}

export function resolveStoryloopTheme(
  theme: ThemeName,
  config?: StoryloopThemeConfig,
): StoryloopTokens {
  return mergeTokens(storyloopTokens[theme], config?.[theme]);
}

export function resolveDefaultTheme(
  config?: StoryloopThemeConfig,
): ThemeName {
  return config?.defaultTheme ?? defaultTheme;
}

export function toCssVariables(tokens: StoryloopTokens): Record<string, string> {
  const { colors, gradient, typography, radius, spacing } = tokens;

  return {
    "--sl-canvas": colors.canvas,
    "--sl-surface": colors.surface,
    "--sl-raised": colors.raised,
    "--sl-line": colors.line,
    "--sl-ink": colors.ink,
    "--sl-body": colors.body,
    "--sl-slate": colors.slate,
    "--sl-dim": colors.dim,
    "--sl-accent": colors.accent,
    "--sl-ok": colors.ok ?? "",
    "--sl-edge": colors.edge,
    "--sl-gradient": `linear-gradient(${gradient.angle}deg, ${gradient.start} 0%, ${gradient.middle} 50%, ${gradient.end} 100%)`,
    "--sl-font-display": typography.displayFamily,
    "--sl-font-body": typography.bodyFamily,
    "--sl-font-system": typography.systemFamily,
    "--sl-weight-display": String(typography.displayWeight),
    "--sl-weight-title": String(typography.titleWeight),
    "--sl-weight-body": String(typography.bodyWeight),
    "--sl-weight-system": String(typography.systemWeight),
    "--sl-system-tracking": typography.systemLetterSpacing,
    ...(radius.sm == null ? {} : { "--sl-radius-sm": `${radius.sm}px` }),
    ...(radius.md == null ? {} : { "--sl-radius-md": `${radius.md}px` }),
    ...(radius.lg == null ? {} : { "--sl-radius-lg": `${radius.lg}px` }),
    ...Object.fromEntries(
      spacing.map((value) => [`--sl-space-${value}`, `${value}px`]),
    ),
  };
}
