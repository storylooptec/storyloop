export type ThemeName = "dark" | "light";

export type StoryloopTokens = {
  colors: {
    canvas: string;
    surface: string;
    raised: string;
    line: string;
    ink: string;
    body: string;
    slate: string;
    dim: string;
    accent: string;
    ok?: string;
    edge: string;
  };
  gradient: {
    angle: number;
    start: string;
    middle: string;
    end: string;
  };
  typography: {
    displayFamily: string;
    bodyFamily: string;
    systemFamily: string;
    displayWeight: number;
    titleWeight: number;
    bodyWeight: number;
    systemWeight: number;
    systemLetterSpacing: string;
  };
  radius: {
    sm: number | null;
    md: number | null;
    lg: number | null;
  };
  spacing: readonly number[];
};

export const storyloopTokens: Record<ThemeName, StoryloopTokens> = {
  dark: {
    colors: {
      canvas: "#0D0D1A",
      surface: "#13131F",
      raised: "#191926",
      line: "#22223A",
      ink: "#FFFFFF",
      body: "#C4C4D2",
      slate: "#888899",
      dim: "#5C5C6E",
      accent: "#E040C8",
      ok: "#3ECF8E",
      edge: "#6E6E85",
    },
    gradient: {
      angle: 135,
      start: "#FF6B6B",
      middle: "#E040C8",
      end: "#7B3FF5",
    },
    typography: {
      displayFamily: "Montserrat",
      bodyFamily: "Montserrat",
      systemFamily: "Exo 2",
      displayWeight: 800,
      titleWeight: 700,
      bodyWeight: 400,
      systemWeight: 700,
      systemLetterSpacing: "0.1em",
    },
    radius: {
      sm: null,
      md: null,
      lg: null,
    },
    spacing: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
  },
  light: {
    colors: {
      canvas: "#F7F7FB",
      surface: "#FFFFFF",
      raised: "#F1F1F6",
      line: "#E3E3EC",
      ink: "#14142B",
      body: "#3C3C50",
      slate: "#6E6E85",
      dim: "#9797AB",
      accent: "#E040C8",
      edge: "#9A9AAE",
    },
    gradient: {
      angle: 135,
      start: "#FF6B6B",
      middle: "#E040C8",
      end: "#7B3FF5",
    },
    typography: {
      displayFamily: "Montserrat",
      bodyFamily: "Montserrat",
      systemFamily: "Exo 2",
      displayWeight: 800,
      titleWeight: 700,
      bodyWeight: 400,
      systemWeight: 700,
      systemLetterSpacing: "0.1em",
    },
    radius: {
      sm: null,
      md: null,
      lg: null,
    },
    spacing: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
  },
};

export const defaultTheme: ThemeName = "dark";
