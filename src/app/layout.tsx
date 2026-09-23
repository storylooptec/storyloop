import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { Exo_2, Montserrat } from "next/font/google";

import {
  resolveDefaultTheme,
  resolveStoryloopTheme,
  toCssVariables,
} from "@/design-system/theme";

import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const exo2 = Exo_2({
  subsets: ["latin"],
  variable: "--font-exo2",
  display: "swap",
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "Storyloop",
  description: "Storyloop platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const themeName = resolveDefaultTheme();
  const tokens = resolveStoryloopTheme(themeName);
  const cssVariables = toCssVariables(tokens) as CSSProperties;

  return (
    <html lang="en" data-theme={themeName}>
      <body
        className={`${montserrat.variable} ${exo2.variable}`}
        style={cssVariables}
      >
        {children}
      </body>
    </html>
  );
}
