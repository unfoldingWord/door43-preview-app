import { useEffect } from "react"
import useGenerateTranslationAcademyManuals from "../hooks/useGenerateTranslationAcademyManuals"
import useGenerateTranslationAcademyHtml from "../hooks/useGenerateTranslationAcademyHtml"
import TaNavigation from "./TaNavigation"
import useFetchZipFileData from "../../core/hooks/useFetchZipFileData"


const webCss = `
section > section:nth-child(1) {
  page-break-before: avoid;
}

section > article:nth-child(1) {
  page-break-before: avoid;
}

article + section, section + article {
  page-break-before: always;
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
.section-header a {
  border-bottom: none;
}

.article-header a {
  border-bottom: none;
}
`

export default function RcTranslationAcademy({
  urlInfo,
  catalogEntry,
  setStatusMessage,
  setErrorMessage,
  setHtml,
  setWebCss,
  setPrintCss,
  setDocumentAnchor,
}) {
  let zipFileData = null
  try {
    zipFileData = useFetchZipFileData({catalogEntry})
  } catch (e) {
    setErrorMessage(e.message)
  }

  let taManuals = null
  try {
    taManuals = useGenerateTranslationAcademyManuals({ catalogEntry, zipFileData, setErrorMessage })
  } catch (e) {
    setErrorMessage(e.message)
  }

  let _html = ""
  try {
    _html = useGenerateTranslationAcademyHtml({ catalogEntry, taManuals })
  } catch (e) {
    setErrorMessage(e.message)
  }

  useEffect(() => {
    setStatusMessage(<>Preparing {catalogEntry.subject} Preview.<br/>Please wait...</>)
    setWebCss(webCss)
    setPrintCss(printCss)
  }, [])

  useEffect(() => {
    // Handle Print Preview & Status & Navigation
    if (_html) {
      setHtml(_html)
      setStatusMessage("")
    }
  }, [_html])

  return (
    <TaNavigation
        taManuals={taManuals} 
        anchor={urlInfo.hash}
        setDocumentAnchor={setDocumentAnchor}
      />
  )
}
