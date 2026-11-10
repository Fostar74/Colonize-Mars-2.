import React, {createContext, useContext, useEffect, useState} from "react";

const LanguageContext = createContext(null);
const storageKey = "colonize-mars-language";

export function LanguageProvider({children}) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved === "en" || saved === "bg" ? saved : null;
  });

  useEffect(() => {
    if (language) document.documentElement.lang = language;
  }, [language]);

  const choose = value => {
    localStorage.setItem(storageKey, value);
    setLanguage(value);
  };

  if (!language) return <main style={{textAlign:"center",padding:32}}>
    <h1>Colonize Mars</h1>
    <p><span lang="bg">Избери език</span> / <span lang="en">Choose a language</span></p>
    <button lang="bg" onClick={() => choose("bg")}>Български</button>{" "}
    <button lang="en" onClick={() => choose("en")}>English</button>
  </main>;

  return <LanguageContext.Provider value={{language,choose}}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const {language,choose} = useContext(LanguageContext);
  return {language,choose,t:(english,bulgarian) => language === "bg" ? bulgarian : english};
}
