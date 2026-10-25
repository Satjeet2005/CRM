"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("forgeflow_theme") as Theme) || "system";
    }
    return "light";
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const applyTheme = (current: Theme) => {
      let effective: "light" | "dark" = "light";
      if (current === "system") {
        effective = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } else {
        effective = current;
      }

      setResolvedTheme(effective);
      if (effective === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    applyTheme(theme);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("forgeflow_theme", newTheme);

    let effective: "light" | "dark" = "light";
    if (newTheme === "system") {
      effective = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      effective = newTheme;
    }
    setResolvedTheme(effective);

    if (effective === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleTheme = () => {
    updateTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return {
    theme,
    resolvedTheme,
    setTheme: updateTheme,
    toggleTheme,
  };
}
