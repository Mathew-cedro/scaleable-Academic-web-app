import React, { createContext, useContext, useState, useEffect } from "react";
import { fil, type TranslationSchema } from "../i18n/locales/fil";
import { en } from "../i18n/locales/en";

export type SupportedLanguage = "fil" | "en";

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: TranslationSchema;
  isTagalog: boolean;
}

const translations: Record<SupportedLanguage, TranslationSchema> = {
  fil,
  en,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem("schedmaster_lang");
      if (saved === "en" || saved === "fil") {
        return saved;
      }
    } catch {
      // ignore localStorage errors in sandboxed environments
    }
    // Default strictly to Tagalog (Wikang Filipino)
    return "fil";
  });

  const setLanguage = (newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem("schedmaster_lang", newLang);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    // Reflect language in HTML lang attribute
    document.documentElement.lang = language === "fil" ? "tl" : "en";
  }, [language]);

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: translations[language],
    isTagalog: language === "fil",
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
