import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme, Platform } from "react-native";

type ThemeMode = "light" | "dark";

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Simple global memory variable to persist theme between screen unmounts/navs even without localstorage
let globalThemeMemory: ThemeMode | null = null;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  
  // Determine initial theme mode
  const getInitialTheme = (): ThemeMode => {
    if (globalThemeMemory) return globalThemeMemory;
    
    // Check localStorage on Web
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      const saved = window.localStorage.getItem("mediLinkTheme");
      if (saved === "light" || saved === "dark") {
        globalThemeMemory = saved;
        return saved;
      }
    }
    
    // Enforce "light" as default theme on phone
    return "light";
  };

  const [themeMode, setThemeState] = useState<ThemeMode>(getInitialTheme);

  // Sync state changes with persistence
  const setThemeMode = (mode: ThemeMode) => {
    setThemeState(mode);
    globalThemeMemory = mode;
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("mediLinkTheme", mode);
    }
  };

  const toggleTheme = () => {
    setThemeMode(themeMode === "light" ? "dark" : "light");
  };

  // Follow system theme changes if no manual preference is set yet
  useEffect(() => {
    // Disabled system sync to prevent forcing dark mode automatically on phone
  }, [systemScheme]);

  const isDark = themeMode === "dark";

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
