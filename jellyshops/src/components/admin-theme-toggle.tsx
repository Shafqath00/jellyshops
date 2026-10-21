"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "jelly-admin-theme";

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark";
  } catch {
    return false;
  }
}

/* Toggles `admin-dark` on <html> while the admin shell is mounted. */
export function AdminThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(readStored());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("admin-dark", dark);
    return () => root.classList.remove("admin-dark");
  }, [dark]);

  function toggle() {
    const next = !dark;
    setDark(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      /* storage unavailable; theme still applies for this session */
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      onClick={toggle}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
