import { useEffect, useContext } from "react"
import useGenerateTranslationWordsManuals from "../hooks/useGenerateTranslationWordsManuals"
import useGenerateTranslationWordsHtml from "../hooks/useGenerateTranslationWordsHtml"
import TwNavigation from "./TwNavigation"
import useFetchZipFileData from "../../core/hooks/useFetchZipFileData"
import { AppContext } from "@components/App.context"


const webCss = `
section > section:nth-child(1),
section > article:nth-child(1) {
  break-before: avoid;
}

h5, h6 {
  font-size: 1em;
}

a.header-link {
  font-weight: inherit !important;
  font-size: inherit !important;
  color: #000000;
  text-decoration: none;
}

a.header-link:hover::after {
  content: "#";
  padding-left: 5px;
  color: blue;
  display: inline-block;
}

.article-body h1, .article-body h2, .article-body h3, .article-body h4 {
  font-size: 1em;
}

hr.divider {
  width: 100%;
}

hr.divider.depth-1 {
  width: 90%;
}

hr.divider.depth-2 {
  width: 80%;
}

hr.divider.depth-3 {
  width: 70%;
}

hr.divider.depth-4 {
  width: 60%;
}

hr.divider.depth-5 {
  width: 40%;
}

hr.article-divider {
  width: 50%;
}

.section-header a {
  border-bottom: 3px double;
}

.article-header a {
  border-bottom: 1px solid;
}

.manual > h1 {
  text-align: center;
}
`

const printCss = `
#pagedjs-print .section-header a {
  border-bottom: none;
}

#pagedjs-print .article-header a {
  border-bottom: none;
}

#pagedjs-print hr.article-divider {
  display: none;
}

#pagedjs-print a,
#pagedjs-print a:hover,
#pagedjs-print a:visited {
  color: inherit;
}
`

export default function RcTranslationWords() {
  const {
    state: {
      catalogEntry,
      documentAnchor,
    },
    actions: {
      setWebCss,
      setPrintCss,
      setStatusMessage,
      setErrorMessage,
      setHtmlSections,
      setDocumentAnchor,
    },
  } = useContext(AppContext)

  const zipFileData = useFetchZipFileData({catalogEntry})

  const twManuals = useGenerateTranslationWordsManuals({ catalogEntry, zipFileData, setErrorMessage })

  const html = useGenerateTranslationWordsHtml({ catalogEntry, taManuals: twManuals })

  useEffect(() => {
    setStatusMessage(<>Preparing {catalogEntry.subject} Preview.<br/>Please wait...</>)
    setWebCss(webCss)
    setPrintCss(printCss)
  }, [catalogEntry, setWebCss, setPrintCss, setStatusMessage])

  useEffect(() => {
    // Handle Print Preview & Status & Navigation
    if (html) {
      setHtmlSections((prevState) => ({...prevState, toc: "", body: html}))
      setStatusMessage("")
    }
  }, [html, twManuals, setHtmlSections, setStatusMessage])

  return (
    <TwNavigation
        twManuals={twManuals} 
        anchor={documentAnchor}
        setDocumentAnchor={setDocumentAnchor}
      />
  )
}
