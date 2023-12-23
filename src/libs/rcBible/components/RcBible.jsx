import { useState, useEffect, useContext } from "react";
import PropTypes from 'prop-types';
import useUsfmPreviewRenderer from "../hooks/useUsfmPreviewRender.jsx";
import DOMPurify from "dompurify";
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
    setStatusMessage,
    setErrorMessage,
    setPrintHtml,
    setCanChangeColumns,
    updateUrlHashLink,
}) {
  const [supportedBooks, setSupportedBooks] = useState([])
  const [usfmText, setUsfmText] = useState()
  const [htmlCache, setHtmlCache] = useState({})
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
        if (b in htmlCache) {
          setHtml(htmlCache[b])
        } else {
          setUsfmText(null)  
          setHtml(null)
        }
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
      updateUrlHashLink([b, c, v])
    }
  }

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: urlInfo.hashParts[0] || supportedBooks[0] || "gen",
    initialChapter: urlInfo.hashParts[1] || "1",
    initialVerse: urlInfo.hashParts[2] || "1",
    onChange: onBibleReferenceChange,
  })

  let book = bibleReferenceState?.bookId || urlInfo.hashParts[0] || supportedBooks[0] || "gen"
  let bookIngredient = {
    identifier: book,
    title: book,
  }
  catalogEntry.ingredients.forEach(ingredient => {
    if (ingredient.identifier == bibleReferenceState.bookId) {
      bookIngredient = ingredient
    }
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
          setErrorMessage("There are no books in this resource to render.")
          return
        }
      
        setSupportedBooks(sb)
        if (sb.length != 66) {
          bibleReferenceActions.applyBooksFilter(sb)
        }

        const book = urlInfo.hashParts[0]?.toLowerCase() || sb[0]
        if (!sb.includes(book)) {
          setErrorMessage(`Invalid book. \`${book}\` is not an existing book in this resource. Generating for ${supportedBooks[0] || "first available book"}.`)
          return
        }

        if(bibleReferenceState?.bookId != book) {
          bibleReferenceActions.goToBookChapterVerse(book, (book == urlInfo.hashParts[0] && urlInfo.hashParts[1]) || "1", (book == urlInfo.hashParts[0] && urlInfo.hashParts[2]) || "1")
        }
    }

    if(catalogEntry && zipFileData) {
        loadSupportedBooks()
    }
  }, [catalogEntry, zipFileData])

  useEffect(() => {
    const loadUsfmFileFromZipFile = async () => {
        setStatusMessage(`Preparing preview for ${bookIngredient?.title || bibleReferenceState?.bookId}. Please wait...`)
        const text = await zipFileData.files[`${catalogEntry.repo.name}/${BibleBookData[bibleReferenceState.bookId].usfm}.usfm`]?.async('text')
        if (text) {
            setUsfmText(text)
        } else {
            setErrorMessage(`USFM file for \`${bibleReferenceState.bookId}\` is empty or invalid.`)
        }
    }

    if(zipFileData && supportedBooks) {
      loadUsfmFileFromZipFile()
    }
  }, [supportedBooks, zipFileData, bibleReferenceState?.bookId])

  useEffect(() => {
    if (htmlReady && renderedData) {
      let _html = renderedData.replaceAll(/id="chapter-(\d+)-verse-(\d+)"/g, `id="${bibleReferenceState.bookId}-$1-$2"`)
      _html = `<h1 style="text-align: center">${catalogEntry.title}</h1>\n${_html}`
      setHtml(_html)
      if (! (bibleReferenceState.bookId in htmlCache)) {
        setHtmlCache({...htmlCache, [bibleReferenceState.bookId]: _html})
      }
    }
  }, [htmlReady, renderedData])

  useEffect(() => {
    // Handling Print Preview & Status & Navigation
    setPrintHtml(html)
    if (html) {
      setStatusMessage("")
      setCanChangeColumns(true)
      bibleReferenceActions.goToBookChapterVerse(bibleReferenceState.bookId, bibleReferenceState.chapter, bibleReferenceState.verse)
    } else {
      setCanChangeColumns(false)
    }
  }, [html])

  return (
    <>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', position: "sticky", "top": "0", background: "inherit", padding: "10px"}}>
        <BibleReference status={bibleReferenceState} actions={bibleReferenceActions}/>
      </div>
      {html && (<>
          <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(html),
            }}
          />
        </>)}
    </>
  )
}

RcBible.propTypes = {
  urlInfo: PropTypes.object,
  catalogEntry: PropTypes.object,
  zipFileData: PropTypes.object,
  setStatusMessage: PropTypes.func,
  setErrorMessage: PropTypes.func,
  setPrintHtml: PropTypes.func,
  setCanChangeColumns: PropTypes.func,
  updateUrlHashLink: PropTypes.func,
}