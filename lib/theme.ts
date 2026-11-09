import { createTheme, type MantineColorsTuple } from "@mantine/core";

const tuple = (c: string[]) => c as unknown as MantineColorsTuple;

// Paleta aconchegante: creme, rosa lótus, sage, amarelo, lavanda, ameixa.
export const theme = createTheme({
  primaryColor: "lotus",
  autoContrast: true,
  luminanceThreshold: 0.22,
  primaryShade: { light: 6, dark: 4 },
  colors: {
    lotus: tuple(["#fff0f6", "#fcdbe8", "#f8bad3", "#f395bc", "#ee77a8", "#e85d97", "#c43f7b", "#ad366a", "#8a2a55", "#681f40"]),
    sage: tuple(["#f1f6ef", "#e0ebdb", "#c7dabf", "#aac79e", "#93b885", "#82ab73", "#6c935e", "#567649", "#415937", "#2c3c25"]),
    sun: tuple(["#fff9e5", "#fdf0c0", "#fbe598", "#f8d96d", "#f5cf4b", "#f2c534", "#d6a921", "#ae8517", "#85650f", "#5c4508"]),
    lavender: tuple(["#f5f1fc", "#e8def7", "#d6c5f0", "#c2a9e8", "#b292e1", "#a47ddb", "#8a62c2", "#6f4ca0", "#55397d", "#3c2859"]),
    plum: tuple(["#f7eef4", "#ead6e3", "#d9b4c9", "#c68fae", "#b57196", "#a85a85", "#8f4570", "#733559", "#552640", "#3a1a2c"]),
    cream: tuple(["#fffdf8", "#fbf5ec", "#f5ead9", "#eedcc0", "#e6cda6", "#debf8f", "#c5a574", "#a1855a", "#7c6642", "#574729"]),
  },
  fontFamily: "var(--font-nunito), ui-rounded, 'SF Pro Rounded', system-ui, sans-serif",
  headings: { fontFamily: "var(--font-nunito), ui-rounded, 'SF Pro Rounded', system-ui, sans-serif", fontWeight: "800" },
  defaultRadius: "lg",
  radius: { xs: "8px", sm: "12px", md: "16px", lg: "20px", xl: "28px" },
  components: {
    Card: { defaultProps: { radius: "xl", withBorder: true, shadow: "xs" } },
    Button: { defaultProps: { radius: "xl" } },
    TextInput: { defaultProps: { radius: "lg", size: "md" } },
    PasswordInput: { defaultProps: { radius: "lg", size: "md" } },
  },
});
