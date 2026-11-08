"use client";

import { createContext, useContext } from "react";
import type { PaletteColor } from "../../color-palette";

/** The theme's colours, offered under every colour field in the editor panel. */
const ColorPaletteContext = createContext<PaletteColor[]>([]);

export const ColorPaletteProvider = ColorPaletteContext.Provider;
export const useColorPalette = (): PaletteColor[] => useContext(ColorPaletteContext);
