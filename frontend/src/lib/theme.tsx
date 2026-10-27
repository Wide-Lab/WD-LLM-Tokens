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
  // `null` até ler o documento: aplicar antes disso escreveria "light" por cima do tema decidido.
  const [lido, setThemeState] = useState<Theme | null>(null);
  const theme: Theme = lido ?? "light";

  useEffect(() => {
    // O script do `<head>` já decidiu; aqui o estado só alcança o que está no documento.
    const noDocumento = document.documentElement.getAttribute("data-theme");
    let initial: Theme = noDocumento === "dark" ? "dark" : "light";
    if (noDocumento !== "light" && noDocumento !== "dark") {
      initial = lerSalvo() ?? temaDoSistema();
    }
    setThemeState(initial);

    // Sem escolha salva, o painel segue o sistema — inclusive quando ele muda com a aba aberta.
    // Depois de uma escolha explícita, o sistema deixa de mandar.
    const consulta = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!consulta) return;
    const aoMudar = (e: MediaQueryListEvent) => {
      if (lerSalvo() === null) setThemeState(e.matches ? "dark" : "light");
    };
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  useEffect(() => {
    if (lido === null) return;
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.classList.toggle("dark", theme === "dark");
  }, [lido, theme]);

  // Só a ação do usuário grava: o tema vindo do sistema não pode virar preferência salva, senão o
  // script do `<head>` nunca mais consultaria o sistema.
  const setTheme = (t: Theme) => {
    salvar(t);
    setThemeState(t);
  };
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
  );
}

function lerSalvo(): Theme | null {
  try {
    const salvo = window.localStorage.getItem(STORAGE_KEY);
    return salvo === "light" || salvo === "dark" ? salvo : null;
  } catch {
    return null;
  }
}

function temaDoSistema(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function salvar(t: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, t);
  } catch {
    // ignore
  }
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
