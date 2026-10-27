import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "llm-token-panel:theme";

/**
 * Aplica o tema salvo antes da primeira pintura. Vai inline no `<head>` (ver `__root.tsx`), por
 * isso é texto e não função: roda antes do bundle, e sem ele a página escura piscaria clara.
 *
 * Grava os dois marcadores que o tema precisa: `data-theme`, que é o que os tokens do wide-ui
 * leem, e a classe `dark`, que é o que a variante `dark:` dos componentes do shadcn lê.
 */
export const SCRIPT_DO_TEMA = `(function(){try{var t=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(t!=="light"&&t!=="dark")t=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var r=document.documentElement;r.setAttribute("data-theme",t);r.classList.toggle("dark",t==="dark")}catch(e){}})()`;

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // `null` até ler o documento: gravar antes disso escreveria "light" por cima do tema salvo.
  const [lido, setThemeState] = useState<Theme | null>(null);
  const theme: Theme = lido ?? "light";

  useEffect(() => {
    // O script do `<head>` já decidiu; aqui o estado só alcança o que está no documento.
    const noDocumento = document.documentElement.getAttribute("data-theme");
    let initial: Theme = noDocumento === "dark" ? "dark" : "light";
    if (noDocumento !== "light" && noDocumento !== "dark") {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark") initial = stored;
        else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) initial = "dark";
      } catch {
        // ignore
      }
    }
    setThemeState(initial);
  }, []);

  useEffect(() => {
    if (lido === null) return;
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [lido, theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggle = () => setThemeState((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
