// Promptular design tokens (brand locked Aug 21, 2026). Mirrors the web
// repo's globals.css. Dark-only app per the power-tool brand direction.

export const colors = {
  ink: "#12102B", // page background
  panel: "#1E1B4B", // cards
  panelEdge: "#312E6E",
  violet: "#8B5CF6", // primary accent
  violetDeep: "#6D47D9",
  spark: "#FACC15", // the Enhance action
  lumen: "#F4F2FF", // primary text
  lumenDim: "#A5A0C2", // secondary text
  good: "#34D399",
  danger: "#F87171",
  heart: "#8B5CF6", // favorites = brand violet; danger stays errors/delete
} as const;

export const radius = {
  card: 16,
  button: 999,
  input: 12,
} as const;

export const spacing = (n: number) => n * 4;
