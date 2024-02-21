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
  width: 640px;
  height: 360px;
}
`

const printCss = `
.obs-story-header {
  page-break-before: always; 
  page-break-after: always;
  text-align: center;
  padding-top: 300px;
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
  catalogEntry,
  setStatusMessage,
  setErrorMessage,
  setHtml,
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

  let _html = ""
  try {
    _html = useGenerateOpenBibleStoriesHtml({ catalogEntry, zipFileData, setErrorMessage })
  } catch (e) {
    setErrorMessage(e.message)
  }

  useEffect(() => {
    setStatusMessage(<>Preparing OBS Preview.<br/>Please wait...</>)
    bibleReferenceActions.applyBooksFilter("obs")
  }, [])

  useEffect(() => {
    // Handle Print Preview & Status & Navigation
    if (_html) {
      setHtml(_html)
      setWebCss(webCss)
      setPrintCss(printCss)
      setStatusMessage("")
    }
  }, [_html])

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
