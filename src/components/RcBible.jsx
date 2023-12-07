import { useState, useEffect, useContext } from "react";
import PropTypes from 'prop-types';
import Typography from "@mui/joy/Typography";
import { useUsfmPreviewRenderer } from "@oce-editor-tools/base";
import DOMPurify from "dompurify";
import CircularProgressUI from "@mui/joy/CircularProgress";
import {
  getLtrPreviewStyle,
  getRtlPreviewStyle,
} from "../lib/previewStyling.js";
import { decodeBase64ToUtf8 } from "../utils/base64Decode";
import { API_PATH } from "../common/constants";
import BibleReference, { useBibleReference } from 'bible-reference-rcl';
import { ALL_BIBLE_BOOKS } from "../common/BooksOfTheBible.js";

export default function RcBible({
    urlInfo,
    serverInfo,
    catalogEntry,
    setErrorMessage,
    setPrintHtml,
    setCanChangeColumns,
    updateUrlHotlink,
}) {
  const [loading, setLoading] = useState(true)
  const [usfmText, setUsfmText] = useState()

  const renderFlags = {
    showWordAtts: false,
    showTitles: true,
    showHeadings: true,
    showIntroductions: true,
    showFootnotes: false,
    showXrefs: false,
    showParaStyles: true,
    showCharacterMarkup: false,
    showChapterLabels: true,
    showVersesLabels: true,
  }

  const onBibleReferenceChange = (book, chapter, verse) => {
    if (chapter > "1" || verse > "5") {
        window.scrollTo({top: document.getElementById(`chapter-${chapter}-verse-${verse}`)?.getBoundingClientRect().top + window.scrollY - 130, behavior: "smooth"});
    }
    updateUrlHotlink({...urlInfo, extraPath: [book, chapter, verse]})
  }

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: urlInfo?.extraPath[0] || catalogEntry?.ingredients.map(ingredient => ingredient.identifier).filter(book => book in ALL_BIBLE_BOOKS)[0] || "gen",
    initialChapter: urlInfo?.extraPath[1] || "1",
    initialVerse: urlInfo?.extraPath[2] || "1",
    supportedBooks: catalogEntry?.ingredients.map(ingredient => ingredient.identifier).filter(book => book in ALL_BIBLE_BOOKS),
    onChange: onBibleReferenceChange,
  })

  const { renderedData, ready: htmlReady } = useUsfmPreviewRenderer({
    usfmText,
    renderFlags,
    renderStyles: catalogEntry
      ? catalogEntry.language_direction === "rtl"
        ? getRtlPreviewStyle()
        : getLtrPreviewStyle()
      : getLtrPreviewStyle(),
    htmlRender: true,
  })

  useEffect(() => {
    if (catalogEntry) {
        let book = ""
        if (urlInfo?.extraPath.length > 0) {
            book = urlInfo.extraPath[0]
        } else if (catalogEntry?.ingredients.length) {
            book = catalogEntry?.ingredients.map(ingredient => ingredient.identifier).filter(book => book in ALL_BIBLE_BOOKS)[0] || "gen"
        } else {
            setErrorMessage("No book given to render")
        }
        const chapter = urlInfo.extraPath[1] || "1"
        const verse = urlInfo.extraPath[2] || "1"
        updateUrlHotlink({...urlInfo, extraPath: [book, chapter, verse]})
        bibleReferenceActions.goToBookChapterVerse(book, chapter, verse)
    }
  }, [catalogEntry])

  useEffect(() => {
    if (bibleReferenceState?.bookId && urlInfo?.extraPath && bibleReferenceState.bookId != urlInfo.extraPath[0]) {
        window.location.href = `/u/${urlInfo.owner}/${urlInfo.repo}/${urlInfo.ref}/${bibleReferenceState.bookId}`
    }
  }, [bibleReferenceState?.bookId, urlInfo])

  useEffect(() => {
    const handleInitialLoad = async (url) => {
      try {
        const response = await fetch(url)
        if (!response.ok) {
          const text = await response.text()
          throw Error(text)
        }

        const jsonResponse = await response.json()
        if (jsonResponse?.content) {
          const _usfmText = decodeBase64ToUtf8(jsonResponse.content)
          setUsfmText(_usfmText)
          setCanChangeColumns(true)
        }
        setLoading(false)
      } catch (error) {
        setErrorMessage(error?.message)
        setLoading(false)
      }
    }

    const loadFile = async () => {
      let filePath = null
      for (let i = 0; i < catalogEntry.ingredients.length; ++i) {
        const ingredient = catalogEntry.ingredients[i]
        if (ingredient.identifier == bibleReferenceState.bookId) {
          filePath = ingredient.path
          break
        }
      }
      if (!filePath) {
        setErrorMessage("Book not supported")
        setLoading(false)
      } else {
        const fileURL = `${serverInfo.baseUrl}/${API_PATH}/repos/${catalogEntry.owner}/${catalogEntry.repo.name}/contents/${filePath}?ref=${catalogEntry.commit_sha}`
        handleInitialLoad(fileURL)
      }
    }

    if (loading && catalogEntry && bibleReferenceState?.bookId && serverInfo?.baseUrl) {
      loadFile()
    }
  }, [loading, catalogEntry, bibleReferenceState.bookId, setErrorMessage, setCanChangeColumns, serverInfo?.baseUrl])

  useEffect(() => {
    if (htmlReady) {
      setPrintHtml(renderedData)
      onBibleReferenceChange(bibleReferenceState.bookId, bibleReferenceState.chapter, bibleReferenceState.verse)
    }
  }, [htmlReady, renderedData, setPrintHtml])

  return (
    <>
      {loading ? (
        <>
          <Typography color="textPrimary" gutterBottom display="inline">
            <>Loading USFM file from server... </>
          </Typography>
          <CircularProgressUI />
        </>
      ) : htmlReady ? (
        <>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', position: "sticky", "top": "60px", background: "inherit", padding: "10px"}}>
            <BibleReference status={bibleReferenceState} actions={bibleReferenceActions}/>
          </div>
          <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(renderedData),
            }}
          />
        </>
      ) : (
        <>
          <Typography color="textPrimary" gutterBottom display="inline">
            <>Converting from Usfm... </>
          </Typography>
          <CircularProgressUI />
        </>
      )}
    </>
  )
}

RcBible.propTypes = {
    urlInfo: PropTypes.object,
    serverInfo: PropTypes.object,
    catalogEntry: PropTypes.object,
    setErrorMessage: PropTypes.func,
    setPrintHtml: PropTypes.func,
    setCanChangeColumns: PropTypes.func,
    updateUrlHotlink: PropTypes.func,
  }