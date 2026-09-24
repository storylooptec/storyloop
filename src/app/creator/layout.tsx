import type { CSSProperties, ReactNode } from "react";

import { brandRowToThemeConfig } from "@/design-system/brand-settings";
import { resolveDefaultTheme, resolveStoryloopTheme, toCssVariables } from "@/design-system/theme";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function CreatorRootLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: brand } = await supabase
    .from("company_brand_settings")
    .select("default_theme,dark_colors,light_colors,gradient,typography,radius,spacing")
    .limit(1)
    .maybeSingle();

  const config = brand ? brandRowToThemeConfig(brand) : undefined;
  const themeName = resolveDefaultTheme(config);
  const tokens = resolveStoryloopTheme(themeName, config);
  const cssVariables = toCssVariables(tokens) as CSSProperties;

  return (
    <div className="creator-root" data-theme={themeName} style={cssVariables}>
      {children}
    </div>
  );
}
