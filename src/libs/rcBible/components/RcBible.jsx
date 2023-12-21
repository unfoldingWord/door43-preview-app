import { useState, useEffect, useContext } from "react";
import PropTypes from 'prop-types';
import Typography from "@mui/joy/Typography";
import useUsfmPreviewRenderer from "../hooks/useUsfmPreviewRender.jsx";
import DOMPurify from "dompurify";
import CircularProgressUI from "@mui/joy/CircularProgress";
import {
  getLtrPreviewStyle,
  getRtlPreviewStyle,
} from "../../core/lib/previewStyling.js";
import BibleReference, { useBibleReference } from 'bible-reference-rcl';
import { BibleBookData } from "../../../common/books.js";
import { getSupportedBooks } from "../../core/lib/books.js";

export default function RcBible({
    urlInfo,
    catalogEntry,
    zipFileData,
    setErrorMessage,
    setPrintHtml,
    setCanChangeColumns,
    updateUrlHashLink,
}) {
  const [loading, setLoading] = useState(true)
  const [supportedBooks, setSupportedBooks] = useState([])
  const [usfmText, setUsfmText] = useState()
  const [html, setHtml] = useState()

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

  const onBibleReferenceChange = (b, c, v) => {
    if (b != bibleReferenceState.bookId) {
        setHtml(null)
        setUsfmText(null)
        setLoading(true)
    } else {
        c = parseInt(c)
        v = parseInt(v)
        if (c > 1 || v > 1) {
            window.scrollTo({top: document.getElementById(`${b}-${c}-${v}`)?.getBoundingClientRect().top + window.scrollY - 130, behavior: "smooth"})
        } else {
            window.scrollTo({top: 0, behavior: "smooth"})
        }
    }
    if (updateUrlHashLink) {
      let hashParts = [b]
      if (c != 1 || v != 1 || urlInfo.hashParts[1] || urlInfo.hashParts[2]) {
          hashParts = [b, c, v]
      }
      updateUrlHashLink(hashParts)
    }
  }

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: urlInfo.hashParts[0] || supportedBooks[0] || "gen",
    initialChapter: urlInfo.hashParts[1] || "1",
    initialVerse: urlInfo.hashParts[2] || "1",
    onChange: onBibleReferenceChange,
  })

  const { renderedData, ready: htmlReady } = useUsfmPreviewRenderer({
    bookId: bibleReferenceState.bookId,
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
    const loadSupportedBooks = async () => {
        const sb = getSupportedBooks(catalogEntry, zipFileData)
        if(! sb) {
          setErrorMessage("There are no books in this resource to render")
          setLoading(false)
          return
        }
      
        const book = urlInfo.hashParts[0]?.toLowerCase() || sb[0]
        if (!sb.includes(book)) {
          setErrorMessage(`Invalid book. \`${book}\` is not an existing book in this resource.`)
          setLoading(false)
          return
        }
      
        setSupportedBooks(sb)
        if (sb.length != 66) {
          bibleReferenceActions.applyBooksFilter(sb)
        }
        bibleReferenceActions.goToBookChapterVerse(book)
    }

    if(catalogEntry && zipFileData) {
        loadSupportedBooks()
    }
  }, [catalogEntry, zipFileData])

  useEffect(() => {
    const loadUsfmFileFromZipFile = async () => {
        const text = await zipFileData.files[`${catalogEntry.repo.name}/${BibleBookData[bibleReferenceState.bookId].usfm}.usfm`]?.async('text')
        if (text) {
            setUsfmText(text)
        } else {
            setErrorMessage(`USFM file for \`${bibleReferenceState.bookId}\` is empty or invalid.`)
        }
        setLoading(false)
    }

    if(zipFileData && loading && supportedBooks && !html) {
        loadUsfmFileFromZipFile()
    }
  }, [zipFileData, loading, supportedBooks, html])

  useEffect(() => {
    if (htmlReady && renderedData) {
      let _html = renderedData.replaceAll(/id="chapter-(\d+)-verse-(\d+)"/g, `id="${bibleReferenceState.bookId}-$1-$2"`)
      _html = `<h1 style="text-align: center">${catalogEntry.title}</h1>\n${_html}`
      setHtml(_html)
      setPrintHtml(_html)
      setCanChangeColumns(true)
    }
  }, [htmlReady, renderedData])

  useEffect(() => {
    if (html) {
        bibleReferenceActions.goToBookChapterVerse(bibleReferenceState.bookId, bibleReferenceState.chapter, bibleReferenceState.verse)
    }
  }, [html])

  return (
    <>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', position: "sticky", "top": "60px", background: "inherit", padding: "10px"}}>
        <BibleReference status={bibleReferenceState} actions={bibleReferenceActions}/>
      </div>
      {loading ? (
        <>
          <Typography color="textPrimary" gutterBottom display="inline">
            <>Loading file from server... </>
          </Typography>
          <CircularProgressUI />
        </>
      ) : html ? (
        <>
          <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(html),
            }}
          />
        </>
      ) : (
        <>
          <Typography color="textPrimary" gutterBottom display="inline">
            <>Converting file... </>
          </Typography>
          <CircularProgressUI />
        </>
      )}
    </>
  )
}

RcBible.propTypes = {
  urlInfo: PropTypes.object,
  catalogEntry: PropTypes.object,
  zipFileData: PropTypes.object,
  setErrorMessage: PropTypes.func,
  setPrintHtml: PropTypes.func,
  setCanChangeColumns: PropTypes.func,
  updateUrlHashLink: PropTypes.func,
}