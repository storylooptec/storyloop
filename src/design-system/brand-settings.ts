import type { Json } from "@/types/database.types";
import type {
  EditableStoryloopTokens,
  StoryloopThemeConfig,
} from "@/design-system/theme";
import type { ThemeName } from "@/design-system/tokens";

type BrandSettingsRow = {
  default_theme: string;
  dark_colors: Json;
  light_colors: Json;
  gradient: Json;
  typography: Json;
  radius: Json;
  spacing: number[];
};

function asRecord(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function themeOverrides(
  colors: Json,
  gradient: Json,
  typography: Json,
  radius: Json,
  spacing: number[],
): EditableStoryloopTokens {
  return {
    colors: asRecord(colors),
    gradient: asRecord(gradient),
    typography: asRecord(typography),
    radius: asRecord(radius),
    spacing,
  } as EditableStoryloopTokens;
}

export function brandRowToThemeConfig(
  row: BrandSettingsRow,
): StoryloopThemeConfig {
  const defaultTheme: ThemeName =
    row.default_theme === "light" ? "light" : "dark";

  return {
    defaultTheme,
    dark: themeOverrides(
      row.dark_colors,
      row.gradient,
      row.typography,
      row.radius,
      row.spacing,
    ),
    light: themeOverrides(
      row.light_colors,
      row.gradient,
      row.typography,
      row.radius,
      row.spacing,
    ),
  };
}
