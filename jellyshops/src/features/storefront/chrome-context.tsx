"use client";
import { createContext, useContext } from "react";
export const StorefrontChromeContext = createContext(false);
export const useStorefrontChrome = () => useContext(StorefrontChromeContext);
