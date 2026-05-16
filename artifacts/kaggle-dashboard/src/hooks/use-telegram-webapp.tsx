import { useEffect, useState } from "react";

export function useTelegramWebApp() {
  const [isTelegram, setIsTelegram] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    // @ts-ignore
    const tg = window.Telegram?.WebApp;
    
    if (tg) {
      setIsTelegram(true);
      tg.ready();
      tg.expand();
      
      const currentTheme = tg.colorScheme || "dark";
      setTheme(currentTheme);
      
      document.documentElement.classList.add("dark"); // Force dark mode as requested
      
      // Optional: Set telegram header/bg colors
      if (tg.setHeaderColor) {
        tg.setHeaderColor(currentTheme === 'dark' ? '#0b111a' : '#0b111a'); 
      }
      if (tg.setBackgroundColor) {
        tg.setBackgroundColor(currentTheme === 'dark' ? '#0b111a' : '#0b111a');
      }
    } else {
      document.documentElement.classList.add("dark");
    }
  }, []);

  return { isTelegram, theme };
}
