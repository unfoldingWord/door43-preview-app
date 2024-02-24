import { useEffect } from 'react'
import PropTypes from 'prop-types'
import { useBibleReference } from 'bible-reference-rcl'
import useGenerateOpenBibleStoriesHtml from '../hooks/useGenerateOpenBibleStoriesHtml'
import useFetchZipFileData from '@libs/core/hooks/useFetchZipFileData'
import BibleReference from 'bible-reference-rcl'
import {
  createTheme,
  ThemeProvider,
} from "@mui/material";

const webCss = `
article img {
  display: block;
  margin: 0 auto;
  width: 100%;
  max-width: 640px;
}
`

const printCss = `
@media print {
  .obs-story-title {
    page-break-after: always !important;
    text-align: center;
    padding-top: 300px;
  }

  article + article {
    page-break-before: unset !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
}
`

const theme = createTheme({
  overrides: {
    MuiInput: {
        "*": {
          borderBottom: "2px solid red",
        },
    },
  },
})

export default function OpenBibleStories({
  urlInfo,
  htmlSections,
  catalogEntry,
  setStatusMessage,
  setErrorMessage,
  setHtmlSections,
  setWebCss,
  setPrintCss,
  setDocumentAnchor,
}) {
  const onBibleReferenceChange = (b, c, v) => {
    setDocumentAnchor([b, c, v].join('-'))      
  }

  const { state: bibleReferenceState, actions: bibleReferenceActions } =
    useBibleReference({
      initialBook: "obs",
      initialChapter: urlInfo.hashParts[1] || "1",
      initialVerse: urlInfo.hashParts[2] || "1",
      onChange: onBibleReferenceChange,
      addOBS: true,
    })

  let zipFileData = null
  try {
    zipFileData = useFetchZipFileData({catalogEntry})
  } catch (e) {
    setErrorMessage(e.message)
  }

  let obsHtmlSections = ""
  try {
    obsHtmlSections = useGenerateOpenBibleStoriesHtml({ catalogEntry, zipFileData, setErrorMessage })
  } catch (e) {
    setErrorMessage(e.message)
  }

  useEffect(() => {
    setStatusMessage(<>Preparing OBS Preview.<br/>Please wait...</>)
    bibleReferenceActions.applyBooksFilter("obs")
  }, [])

  useEffect(() => {
    // Handle Print Preview & Status & Navigation
    if (obsHtmlSections) {
      setHtmlSections({...htmlSections, ...obsHtmlSections})
      setWebCss(webCss)
      setPrintCss(printCss)
      setStatusMessage("")
    }
  }, [obsHtmlSections])

  return (
    <ThemeProvider theme={theme}>
      <BibleReference
        status={bibleReferenceState}
        actions={bibleReferenceActions}
        style={{minWidth: "auto"}}
      />
    </ThemeProvider>
  )
}
