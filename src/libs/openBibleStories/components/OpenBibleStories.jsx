import { useEffect, useState, useContext } from 'react'
import { AppContext } from '@components/App.context'
import { useBibleReference } from 'bible-reference-rcl'
import useGetOBSData from '../hooks/useGetOBSData'
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material'
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
.obs-story-title {
  text-align: center;
}

#pagedjs-print .obs-story-title {
  break-after: page !important;
  padding-top: 300px;
}

article {
  break-before: auto;
  break-after: auto;
}

section {
  break-before: page;
  break-after: page;
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

export default function OpenBibleStories() {
  const {
    state: {
      catalogEntry,
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

  const [imageResolution, setImageResolution] = useState('360px');

  const onBibleReferenceChange = (b, c, v) => {
    setDocumentAnchor(`${b}-${c}-${v}`)
  }

  const {state: bibleReferenceState, actions: bibleReferenceActions} = useBibleReference({
      initialBook: "obs",
      initialChapter: "1",
      initialVerse: "1",
      onChange: onBibleReferenceChange,
      addOBS: true,
    })

  const zipFileData = useFetchZipFileData({catalogEntry})

  const obsData = useGetOBSData({catalogEntry, zipFileData, setErrorMessage})

  const obsHtmlSections = useGenerateOpenBibleStoriesHtml({ obsData, setErrorMessage, resolution: imageResolution })

  useEffect(() => {
    setStatusMessage(<>Preparing OBS Preview.<br/>Please wait...</>)
    bibleReferenceActions.applyBooksFilter(["obs"])
  }, [setStatusMessage])

  useEffect(() => {
    // Handle Print Preview & Status & Navigation
    if (obsHtmlSections) {
      setHtmlSections((prevState) => {return {...prevState, ...obsHtmlSections}})
      setWebCss(webCss)
      setPrintCss(printCss)
      setStatusMessage("")
    }
  }, [obsHtmlSections, setHtmlSections, setWebCss, setPrintCss, setStatusMessage])

  return (
    <ThemeProvider theme={theme}>
      <BibleReference
        status={bibleReferenceState}
        actions={bibleReferenceActions}
        style={{minWidth: "auto"}}
      />
      <FormControl>
        <InputLabel id="image-resolution-label">
          Images
        </InputLabel>
        <Select
          labelId="image-resolution-label"
          label="Images"
          value={imageResolution}
          onChange={(event) => setImageResolution(event.target.value)}>
          <MenuItem value="none">Hide Images</MenuItem>
          <MenuItem value="360px">640x360px</MenuItem>
          <MenuItem value="2160px">3840x2160px</MenuItem>
        </Select>
      </FormControl>
    </ThemeProvider>
  )
}
