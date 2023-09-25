import { useState, useCallback } from "react";
import useDeepCompareEffect from 'use-deep-compare-effect';


/* The languages JSON is an array of objects. Sample:
{
  "pk": 6,
  "ang": "Afar",
  "lr": "Africa",
  "gw": false,
  "hc": "ET",
  "ln": "Afaraf",
  "lc": "aa",
  "ld": "ltr",
  "alt": [
    "Afaraf",
    "Danakil",
    "Denkel",
    "Adal",
    "Afar Af",
    "Qafar",
    "Baadu (Ba'adu)"
  ],
  "cc": ["DJ", "ER", "ET", "US", "CA"]
},
*/

export function useLanguages() {
  const [languages, setLanguages] = useState([]);

  useDeepCompareEffect( () => {
    async function getLanguages() {
      const langs = (await fetch('https://td2.unfoldingword.org/exports/langnames.json'))
      const _langs = await langs.json()
      setLanguages(_langs);
    }

    if (languages.length === 0) {
      //console.log("languages is empty... fetching")
      getLanguages();
    }
  }, [languages]
  );

  const formatLanguage = useCallback((lg) => {
    // pattern for uw format: (am) Amharic – አማርኛ (Africa Gateway)
    const lc = lg.lc ? lg.lc : 'UNK';
    const ang = lg.ang ? lg.ang : 'UNK';
    const ln = lg.ln ? lg.ln : 'UNK';
    const lr = lg.lr ? lg.lr : 'UNK';
    return `(${lc}) ${ang} - ${ln} (${lr})`
  }, []);
  
  const getAllLanguages = () => {
    return languages;
  };

  const getLanguage = useCallback((languageId) => {
    for (let i=0; i<languages.length; i++) {
      if (languages[i].lc === languageId) {
        return languages[i]
      }
    }
    return {};  
  }, [languages]);
  
  const getGatewayLanguages = useCallback(() => {
    let _languages = [];
    for (let i=0; i<languages.length; i++) {
      if (languages[i].gw) {
        _languages.push( formatLanguage(languages[i]) )
      }
    }
    return _languages;
  }, [languages, formatLanguage]);

  const actions = {
    getAllLanguages,
    getLanguage,
    getGatewayLanguages,
    formatLanguage,
  };


  // We return these computed values for the passed date prop to our hook
  return { 
    state: languages,
    actions,
 };
};

export default useLanguages;