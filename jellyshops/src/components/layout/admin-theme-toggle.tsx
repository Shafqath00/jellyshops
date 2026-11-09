"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "jelly-admin-theme";
const subscribe = () => () => {};
const serverSnapshot = () => false;

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark";
  } catch {
    return false;
  }
}

/* Toggles `admin-dark` on <html> while the admin shell is mounted. */
export function AdminThemeToggle({ className = "jk-icon-button" }: { className?: string }) {
  const storedDark = useSyncExternalStore(subscribe, readStored, serverSnapshot);
  const [selectedDark, setDark] = useState<boolean | null>(null);
  const dark = selectedDark ?? storedDark;

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
    <button
      type="button"
      className={className}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      onClick={toggle}
    >
      {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
    </button>
  );
}
