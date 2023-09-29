import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
// import Bible from "./Bible";
import { BASE_DCS_URL, API_PATH } from "../common/constants";

export const AppContext = React.createContext();

export function AppContextProvider({ children }) {
  const [printPreview, setPrintPreview] = useState(false)
  const [html, setHtml] = useState("")

  const [errorMessage, setErrorMessage] = useState()
  const [urlInfo, setUrlInfo] = useState(null)
  const [catalogEntry, setCatalogEntry] = useState(null)
  const [bibleReference, setBibleReference] = useState({
    book: "gen",
    chapter: "1",
    verse: "1",
  })

  useEffect(() => {
    const urlParts = (new URL(window.location.href)).pathname.replace(/^\/u\//, "").split("/")
    const info = {
      owner: urlParts[0] || "unfoldingWord",
      repo: urlParts[1] || "en_ult",
      ref: urlParts[2] || "master",
    }
    const br = {
      book: urlParts[3] || bibleReference.book,
      chapter: urlParts[4] || bibleReference.chapter,
      verse: urlParts[5] || bibleReference.verse,
    }
    window.history.pushState({id: "100"}, "Page", `/u/${info.owner}/${info.repo}/${info.ref}/${br.book}/${br.chapter !== "1" || br.verse !== "1"?`${br.chapter}/${br.verse}/`: ""}`);
    setUrlInfo(info)
    setBibleReference(br)
  }, [])

  useEffect(() => {
    const fetchCatalogEntry = async () => {
      fetch(`${BASE_DCS_URL}/${API_PATH}/catalog/entry/${urlInfo.owner}/${urlInfo.repo}/${urlInfo.ref}`)
      .then(response => {
        return response.json();
      })
      .then(data => {
        setCatalogEntry(data)
          // switch (data.subject) {
        //   case "Aligned Bible":
        //   case "Bible":
        //     setResourceComponent(<Bible />);
        //     break;
        //   default:
        //     setHtml(`${resourceInfo.subject} is not yet supported.`);
        // }
      }).catch(() => {
        setErrorMessage("Not found")
      })
    }

    if (!catalogEntry && urlInfo) {
      fetchCatalogEntry().catch(setErrorMessage);
    }
  }, [urlInfo, bibleReference]);

  useEffect(() => {
    if (printPreview && html) {
      console.log("html data is available");
      const newPage = window.open("", "", "_window");
      newPage.document.head.innerHTML = "<title>PDF Preview</title>";
      const script = newPage.document.createElement("script");
      script.src = "https://unpkg.com/pagedjs/dist/paged.polyfill.js";
      newPage.document.head.appendChild(script);
      const style = newPage.document.createElement("style");
      const newStyles = `
      body {
        margin: 0;
        background: grey;
      }
      .pagedjs_pages {
      }
      .pagedjs_page {
        background: white;
        margin: 1em;
      }
      .pagedjs_right_page {
        float: right;
      }
      .pagedjs_left_page {
        float: left;
      }
      div#page-2 {
        clear: right;
      }
      div.bibleBookBody {
        columns: 2;
        column-gap: 2em;
        widows: 2;
      }
      `;
      style.innerHTML =
        newStyles +
        html.replace(/^[\s\S]*<style>/, "").replace(/<\/style>[\s\S]*/, "");
      newPage.document.head.appendChild(style);
      newPage.document.body.innerHTML = html
        .replace(/^[\s\S]*<body>/, "")
        .replace(/<\/body>[\s\S]*/, "");
      setPrintPreview(false);
    }
  }, [printPreview, html]);

  // create the value for the context provider
  const context = {
    state: {
      printPreview,
      html,
      urlInfo,
      catalogEntry,
      bibleReference,
      errorMessage,
    },
    actions: {
      setBibleReference,
      setPrintPreview,
      setHtml,
      setErrorMessage,
    },
  };

  return <AppContext.Provider value={context}>{children}</AppContext.Provider>;
}

AppContextProvider.propTypes = {
  /** Children to render inside of Provider */
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
};
