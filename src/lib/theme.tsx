// Promptular design tokens. Original brand (restored Sept 12, 2026):
// purple #8c52ff, teal #48c9b0, light ground by default, dark as a user
// choice. Token names are kept from the first build so screens did not
// need to change; every screen reads them through useColors() so a theme
// switch re-renders in place.
//
// ink = screen background, panel = cards, panelEdge = hairlines,
// violet = purple used as text/border/icon, spark = primary button fill,
// onSpark = text on a spark button, lumen = text, lumenDim = secondary text,
// teal = results/success accent, warn = banner warning, danger = errors.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_KEY = "promptular.theme";

export interface Colors {
  ink: string;
  panel: string;
  panelEdge: string;
  violet: string;
  violetDeep: string;
  spark: string;
  onSpark: string;
  lumen: string;
  lumenDim: string;
  teal: string;
  good: string;
  warn: string;
  onWarn: string;
  danger: string;
  heart: string;
  markBg: string;
}

const light: Colors = {
  ink: "#FFFFFF",
  panel: "#F5F1FD",
  panelEdge: "#E4DBF7",
  violet: "#6E36E0",
  violetDeep: "#5B2BC7",
  spark: "#8C52FF",
  onSpark: "#FFFFFF",
  lumen: "#1B152B",
  lumenDim: "#6B6483",
  teal: "#48C9B0",
  good: "#1F8F7A",
  warn: "#F59E0B",
  onWarn: "#1B152B",
  danger: "#DC2626",
  heart: "#8C52FF",
  markBg: "#E3D8FC",
};

const dark: Colors = {
  ink: "#1B152B",
  panel: "#2B2244",
  panelEdge: "#3D3260",
  violet: "#BFA0FF",
  violetDeep: "#A57CFF",
  spark: "#8C52FF",
  onSpark: "#FFFFFF",
  lumen: "#F3EFFB",
  lumenDim: "#A79FC2",
  teal: "#48C9B0",
  good: "#6FE0C9",
  warn: "#F59E0B",
  onWarn: "#1B152B",
  danger: "#F87171",
  heart: "#A57CFF",
  markBg: "#2B2244",
};

export const palettes = { light, dark } as const;

export const radius = {
  card: 16,
  button: 999,
  input: 12,
} as const;

export const spacing = (n: number) => n * 4;

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  colors: Colors;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  resolved: "light",
  colors: light,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") setModeState(v);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const resolved: ResolvedTheme =
      mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
    return {
      mode,
      resolved,
      colors: palettes[resolved],
      setMode: (next) => {
        setModeState(next);
        AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
      },
    };
  }, [mode, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useColors(): Colors {
  return useContext(ThemeContext).colors;
}
