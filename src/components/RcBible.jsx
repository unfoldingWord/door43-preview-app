import { useState, useEffect, useContext } from "react";
import PropTypes from 'prop-types';
import Typography from "@mui/joy/Typography";
import useUsfmPreviewRenderer from "../hooks/useUsfmPreviewRender.jsx";
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
import { redirectToUrl } from "../utils/url.js"
import * as JSZip from 'jszip'
import { BibleBookData } from "../common/books.js";

export default function RcBible({
    urlInfo,
    catalogEntry,
    setErrorMessage,
    setPrintHtml,
    setCanChangeColumns,
    updateUrlHashLink,
}) {
  const [loading, setLoading] = useState(true)
  const [zipFileData, setZipFileData] = useState()
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
    let hashParts = [b]
    if (c != 1 || v != 1 || urlInfo.hashParts[1] || urlInfo.hashParts[2]) {
        hashParts = [b, c, v]
    }
    updateUrlHashLink({...urlInfo, hashParts})
  }

  const supportedBooks = catalogEntry.ingredients.map(ingredient => ingredient.identifier.toLowerCase()).filter(id => id in ALL_BIBLE_BOOKS)
  if(! supportedBooks) {
    setErrorMessage("There are no books in this resource to render")
    return
  }

  const book = urlInfo.hashParts[0]?.toLowerCase() || supportedBooks[0]
  if (!supportedBooks.includes(book)) {
    setErrorMessage(`Invalid book. ${book} is not an existing book in this resource.`)
    return
  }

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: book,
    initialChapter: urlInfo.hashParts[1] || "1",
    initialVerse: urlInfo.hashParts[2] || "1",
    onChange: onBibleReferenceChange,
  })
  if (supportedBooks.length != 66) {
      bibleReferenceActions.applyBooksFilter(supportedBooks)
  }

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
    const loadZipFile = async () => {
      try {
        console.log("Downloading ", catalogEntry.zipball_url)
        fetch(catalogEntry.zipball_url)
        .then(response => response.arrayBuffer())
        .then(data => setZipFileData(data))
      } catch (error) {
        setErrorMessage(error?.message)
        setLoading(false)
      }
    }

    if (!zipFileData) {
        loadZipFile()
    }
  }, [zipFileData])

  useEffect(() => {
    const loadUsfmFileFromZipFile = () => {
      JSZip.loadAsync(zipFileData)
        .then(zip => zip.file(`${catalogEntry.repo.name}/${BibleBookData[bibleReferenceState.bookId].usfm}.usfm`).async('text'))
        .then(text => {
            setUsfmText(text);
            setLoading(false)
        })
        .catch(error => setErrorMessage(error?.message));
    }

    if(zipFileData && loading && !html) {
        loadUsfmFileFromZipFile()
    }
  }, [zipFileData, loading, html])


  useEffect(() => {
    if (htmlReady && renderedData) {
      let _html = renderedData.replaceAll(/id="chapter-(\d+)-verse-(\d+)"/g, `id="${bibleReferenceState.bookId}-$1-$2"`)
      _html = `<h1 style="text-align: center">${catalogEntry.title}</h1>\n${_html}`
      setHtml(_html)
      setPrintHtml(_html)
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
  setErrorMessage: PropTypes.func,
  setPrintHtml: PropTypes.func,
  setCanChangeColumns: PropTypes.func,
  updateUrlHashLink: PropTypes.func,
}