import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import useUsfmPreviewRenderer from '../hooks/useUsfmPreviewRender'
import DOMPurify from 'dompurify'
import {
  getLtrPreviewStyle,
  getRtlPreviewStyle,
} from "@libs/core/lib/previewStyling.js"
import { useBibleReference } from 'bible-reference-rcl'
import { BibleBookData } from '@common/books'
import { getSupportedBooks } from '@libs/core/lib/books'
import BibleReferencePrintBar from '@libs/core/components/bibleReferencePrintBar'
import { getRepoContentsContent, getRepoGitTrees } from '@libs/core/lib/dcsApi'


export default function Bible({
  urlInfo,
  catalogEntry,
  setStatusMessage,
  setErrorMessage,
  setPrintHtml,
  setCanChangeColumns,
  updateUrlHashInAddressBar,
  onPrintClick,
}) {
  const [supportedBooks, setSupportedBooks] = useState([])
  const [bookId, setBookId] = useState()
  const [bookIdToProcess, setBookIdToProcess] = useState()
  const [usfmText, setUsfmText] = useState()
  const [htmlCache, setHtmlCache] = useState({})
  const [html, setHtml] = useState("")

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
    if (b != bookId) {
      setBookId(b)
    } else {
      c = parseInt(c)
      v = parseInt(v)
      if (c > 1 || v > 1) {
        const verseEl = document.getElementById(`${b}-${c}-${v}`)
        if (verseEl) {
          window.scrollTo({
            top: verseEl.getBoundingClientRect().top + window.scrollY - 80,
            behavior: "smooth",
          })
        }
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    }
    if (updateUrlHashInAddressBar) {
      updateUrlHashInAddressBar([b, c, v])
    }
  }

  const { state: bibleReferenceState, actions: bibleReferenceActions } =
    useBibleReference({
      initialBook: bookId || urlInfo.hashParts[0] || "gen",
      initialChapter: urlInfo.hashParts[1] || "1",
      initialVerse: urlInfo.hashParts[2] || "1",
      onChange: onBibleReferenceChange,
    })

  const { renderedData, ready: htmlReady } = useUsfmPreviewRenderer({
    bookId: bookIdToProcess,
    usfmText,
    renderFlags,
    renderStyles: catalogEntry?.language_direction === "rtl" ? getRtlPreviewStyle() : getLtrPreviewStyle(),
    htmlRender: true,
    setErrorMessage,
  })

  useEffect(() => {
    const setInitialBookIdAndSupportedBooks = async () => {
      if (!catalogEntry) {
        setErrorMessage("No catalog entry for this resource found.")
        return
      }

      let repoFileList = null
      try {
        repoFileList = (await getRepoGitTrees(catalogEntry.repo.url, catalogEntry.branch_or_tag_name, true)).tree.map(tree => tree.path)
      } catch(e) {
        console.log(e)
      }

      let sb = getSupportedBooks(catalogEntry, repoFileList)
      if (!sb.length) {
        setErrorMessage("There are no books in this resource to render.")
        return
      }
      setSupportedBooks(sb)
      bibleReferenceActions.applyBooksFilter(sb)

      let _bookId = urlInfo.hashParts[0] || sb[0]
      if (! _bookId) {
        setErrorMessage("Unable to determine a book ID to render.")
        return
      }
      setBookId(_bookId)
      if (!sb.includes(_bookId)) {
        setErrorMessage(`This resource does not support the rendering of the book \`${_bookId}\`. Please choose another book to render.`)
        sb = [_bookId, ...sb]
      }
    }

    if (!bookId) {
      setInitialBookIdAndSupportedBooks()
    }
  }, [])

  useEffect(() => {
    const handleSelectedBook = async () => {
      // setting a new book, so clear all and get html from cache if exists
      if (bookId in htmlCache) {
        setHtml(htmlCache[bookId])
      } else if (supportedBooks.includes(bookId)) {
        let bookTitle = catalogEntry.ingredients.filter(ingredient => ingredient.identifier == bookId).map(ingredient=>ingredient.title)[0] || bookId
        setStatusMessage(<>Preparing preview for {bookTitle}.<br/>Please wait...</>)
        setUsfmText("")
        setHtml("")
        setBookIdToProcess(bookId)
        bibleReferenceActions.applyBooksFilter(supportedBooks)
      } else {
        setErrorMessage(`This resource does not support the rendering of the book \`${bookId}\`. Please choose another book to render.`)
      }
    }

    if (bookId) {
      handleSelectedBook()
    }
  }, [bookId])

  useEffect(() => {
    const fetchUsfmFileFromDCS = async () => {
      if (! (bookIdToProcess in BibleBookData)) {
        setErrorMessage(`Invalid book: ${bookIdToProcess}`)
        return
      }

      let filePath = ""
      catalogEntry.ingredients.forEach(ingredient => {
        if (ingredient.identifier == bookIdToProcess) {
          filePath = ingredient.path.replace(/^\.\//, "")
        }
      })
      if (! filePath) {
        setErrorMessage(`Book \`${bookIdToProcess}\` is not in repo's project list.`)
      }

      getRepoContentsContent(catalogEntry.repo.url, filePath, catalogEntry.commit_sha).
      then(usfm => setUsfmText(usfm)).
      catch(e => {
        console.log(e)
        setErrorMessage(`Unable to get content for book \`${bookIdToProcess}\` from DCS`)
      })
    }

    if (catalogEntry && supportedBooks && bookIdToProcess && supportedBooks.includes(bookIdToProcess)) {
      fetchUsfmFileFromDCS()
    }
  }, [supportedBooks, catalogEntry, bookIdToProcess])

  useEffect(() => {
    const handleRenderedDataFromUsfmToHtmlHook = async () => {
      let _html = renderedData.replaceAll(
        /id="chapter-(\d+)-verse-(\d+)"/g,
        `id="${bookIdToProcess}-$1-$2"`
      )
      _html = `<h1 style="text-align: center">${catalogEntry.title}</h1>\n${_html}`
      setHtml(_html)
      if (!(bookIdToProcess in htmlCache)) {
        setHtmlCache({ ...htmlCache, [bookIdToProcess]: _html })
      }
    }

    if (htmlReady && renderedData && !(bookIdToProcess in htmlCache)) {
      handleRenderedDataFromUsfmToHtmlHook()
    }
  }, [htmlReady, renderedData])

  useEffect(() => {
    const handlePrintSettingsAndNavigation = async () => {
      setPrintHtml(html)
      setStatusMessage("")
      setCanChangeColumns(true)
      bibleReferenceActions.goToBookChapterVerse(
        bookId,
        bibleReferenceState.chapter,
        bibleReferenceState.verse
      )
    }

    if (html) {
      handlePrintSettingsAndNavigation()
    } else {
      setPrintHtml("")
      setCanChangeColumns(false)
    }
  }, [html])

  return (
    <>
      <BibleReferencePrintBar 
        bibleReferenceState={bibleReferenceState} 
        bibleReferenceActions={bibleReferenceActions}
        onPrintClick={onPrintClick} 
        printEnabled={html != ""} />
      {html && <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(html),
            }}
          />}
    </>
  )
}

Bible.propTypes = {
  urlInfo: PropTypes.object.isRequired,
  catalogEntry: PropTypes.object.isRequired,
  setStatusMessage: PropTypes.func,
  setErrorMessage: PropTypes.func,
  setPrintHtml: PropTypes.func,
  setCanChangeColumns: PropTypes.func,
  updateUrlHashInAddressBar: PropTypes.func,
  onPrintClick: PropTypes.func,
}
