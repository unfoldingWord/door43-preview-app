import { useState, useEffect } from "react"
import PropTypes from "prop-types"
import DOMPurify from "dompurify"
import {
  getLtrPreviewStyle,
  getRtlPreviewStyle,
} from "../../core/lib/previewStyling.js"
import { useBibleReference } from "bible-reference-rcl"
import { BibleBookData } from "../../../common/books"
import { getSupportedBooks } from "../../core/lib/books"
import BibleReference from 'bible-reference-rcl'
import { getRepoContentsContent, getRepoGitTrees } from "../../core/lib/dcsApi"
import useFetchRelationCatalogEntries from "../../core/hooks/useFetchRelationCatalogEntries"
import useFetchBookFileBySubject from "../../core/hooks/useFetchBookFileBySubject"
import useTsvGLQuoteAdder from "../../core/hooks/useTsvGLQuoteAdder"
import usfm from "usfm-js";
import MarkdownIt from "markdown-it";
import { verseObjectsToString } from "uw-quote-helpers";


export default function RcTranslationQuestions({
  urlInfo,
  catalogEntry,
  htmlSections,
  setStatusMessage,
  setErrorMessage,
  setHtmlSections,
  setCanChangeColumns,
  updateUrlHashInAddressBar,
  onPrintClick,
}) {
  const [supportedBooks, setSupportedBooks] = useState([])
  const [bookId, setBookId] = useState()
  const [bookIdToProcess, setBookIdToProcess] = useState()
  const [tsvText, setTsvText] = useState()
  const [htmlCache, setHtmlCache] = useState({})

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

  const { relationCatalogEntries } = useFetchRelationCatalogEntries({
    catalogEntry,
  })

  const { fileContents: sourceUsfm } = useFetchBookFileBySubject({
    catalogEntries: relationCatalogEntries,
    bookId: bookIdToProcess,
    subject: BibleBookData[bookIdToProcess]?.testament == "old" ? "Hebrew Old Testament" : "Greek New Testament",
  })

  const { fileContents: targetUsfm, catalogEntry: targetCatalogEntry } = useFetchBookFileBySubject({
    catalogEntries: relationCatalogEntries,
    bookId: bookIdToProcess,
    subject: "Aligned Bible",
  })

  const { renderedData: renderedTsvData, ready: glQuotesReady } =
    useTsvGLQuoteAdder({
      tsvText,
      sourceUsfm,
      targetUsfm,
    })

  useEffect(() => {
    const setInitialBookIdAndSupportedBooks = async () => {
      if (!catalogEntry) {
        setErrorMessage("No catalog entry for this resource found.")
        return
      }

      let repoFileList = null
      try {
        repoFileList = (await getRepoGitTrees(catalogEntry.repo.url, catalogEntry.branch_or_tag_name, false)).tree.map(tree => tree.path)
      } catch(e) {
        console.log(`Error calling getRepoGitTrees(${catalogEntry.repo.url}, ${catalogEntry.branch_or_tag_name}, false): `, e)
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
        setHtmlSections({...htmlSections, toc: "", body: htmlCache[bookId]})
      } else if (supportedBooks.includes(bookId)) {
        let bookTitle = catalogEntry.ingredients.filter(ingredient => ingredient.identifier == bookId).map(ingredient=>ingredient.title)[0] || bookId
        setStatusMessage(<>Preparing preview for {bookTitle}.<br/>Please wait...</>)
        setTsvText("")
        setHtmlSections({...htmlSections, toc: "", body: ""})
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
    const fetchTsvFileFromDCS = async () => {
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
        then(tsv => setTsvText(tsv)).
        catch(e => {
          console.log(`Error calling getRepoContentsContent(${catalogEntry.repo.url}, ${filePath}, ${catalogEntry.commit_sha}): `, e)
          setErrorMessage(`Unable to get content for book \`${bookIdToProcess}\` from DCS`)
        })
    }

    if (catalogEntry && supportedBooks && bookIdToProcess && supportedBooks.includes(bookIdToProcess)) {
      fetchTsvFileFromDCS()
    }
  }, [supportedBooks, catalogEntry, bookIdToProcess])

  useEffect(() => {
    const generateHtml = async () => {
      let html = `<h1 style="text-align: center">${catalogEntry.title}</h1>\n`
      let prevChapter = ""
      let prevVerse = ""
      const usfmJSON = usfm.toJSON(targetUsfm)
      const md = new MarkdownIt()

      renderedTsvData.forEach((row) => {
        if (!row || !row.ID || !row.Note) {
          return
        }
        const chapterStr = row.Reference.split(":")[0]
        const verseStr = row.Reference.split(":")[1]
        html += `<article class="tn-note">`
        if (chapterStr != "front" && verseStr == "intro") {
          html += `<span id="${bibleReferenceState.bookId}-${chapterStr}-1"></span>`
        }
        if (chapterStr != prevChapter || verseStr != prevVerse) {
          const firstVerse = verseStr.split(",")[0].split("-")[0].split("–")[0]
          if (chapterStr != "front" && firstVerse != "intro") {
            if (firstVerse != prevVerse) {
              html += `<h2 id="${bibleReferenceState.bookId}-${chapterStr}-${firstVerse}" class="tn-chapter-header">${chapterStr}:${verseStr}</h2>`
            } else {
              html += `<h2>${chapterStr}:${verseStr}</h2>`
            }
            const scripture = verseObjectsToString(
              usfmJSON.chapters[chapterStr][firstVerse]?.verseObjects
            )
            html += `<div class="tn-chapter-verse-scripture"><span style="font-weight: bold">${targetCatalogEntry.abbreviation.toUpperCase()}</span>: <em>${scripture}</em></div>`
          }
          prevChapter = chapterStr
          prevVerse = verseStr
        }
        if (row.GLQuote || row.Quote) {
          html += `<h3 class="tn-note-header">${
            row.GLQuote || row.Quote
          }</h3>`
        }
        html += `<div class="tn-note-body">${md.render(
          row.Note.replaceAll("\\n", "\n").replaceAll("<br>", "\n")
        )}</div>
            <hr style="width: 75%"/>
          </article>`
      })
      setHtmlSections({...htmlSections, toc: "", body: html})
      setHtmlCache({...htmlCache, [bookIdToProcess]: html})
    }

    if (targetCatalogEntry && renderedTsvData && glQuotesReady) {
      generateHtml()
    }
  }, [targetCatalogEntry, renderedTsvData, glQuotesReady])

  useEffect(() => {
    const handlePrintSettingsAndNavigation = async () => {
      setHtmlSections({...htmlSections, toc: "", body: html})
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
      setHtmlSections({})
      setCanChangeColumns(false)
    }
  }, [html])

  return (
    <BibleReference
      status={bibleReferenceState}
      actions={bibleReferenceActions} />
  )
}

RcTranslationQuestions.propTypes = {
  urlInfo: PropTypes.object.isRequired,
  catalogEntry: PropTypes.object.isRequired,
  setStatusMessage: PropTypes.func,
  setErrorMessage: PropTypes.func,
  setHtml: PropTypes.func,
  setCanChangeColumns: PropTypes.func,
  updateUrlHashInAddressBar: PropTypes.func,
  onPrintClick: PropTypes.func,
}
