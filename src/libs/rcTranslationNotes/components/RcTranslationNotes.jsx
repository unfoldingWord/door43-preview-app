import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useBibleReference } from 'bible-reference-rcl'
import { BibleBookData } from '@common/books'
import { getSupportedBooks } from '@libs/core/lib/books'
import BibleReference from 'bible-reference-rcl'
import { getRepoContentsContent, getRepoGitTrees } from '@libs/core/lib/dcsApi'
import useFetchRelationCatalogEntries from '@libs/core/hooks/useFetchRelationCatalogEntries'
import useFetchBookFileBySubject from '@libs/core/hooks/useFetchBookFileBySubject'
import useTsvGLQuoteAdder from '@libs/core/hooks/useTsvGLQuoteAdder'
import usfm from 'usfm-js'
import MarkdownIt from 'markdown-it'
import { verseObjectsToString } from 'uw-quote-helpers'


const webCss = `
.tn-entry h1 {
  font-size: 1.4em;
  margin: 10px 0;
}

.tn-entry h2 {
  font-size: 1.2em;
  margin: 10px 0;
}

.tn-entry h3, .tn-entry h4 {
  font-size: 1.1em;
  margin: 10px 0;
}

article + article {
  page-break-before: avoid !important;
}

hr {
  page-break-before: avoid !important;
}
`

export default function RcTranslationNotes({
  urlInfo,
  catalogEntry,
  htmlSections,
  setStatusMessage,
  setErrorMessage,
  setDocumentAnchor,
  setHtmlSections,
  setWebCss,
  setPrintCss,
  setCanChangeColumns,
  updateUrlHashInAddressBar,
  onPrintClick,
}) {
  const [supportedBooks, setSupportedBooks] = useState([])
  const [bookId, setBookId] = useState()
  const [bookTitle, setBookTitle] = useState()
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
      setDocumentAnchor(b)
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
      setWebCss(webCss)
      setCanChangeColumns(false)
      setInitialBookIdAndSupportedBooks()
    }
  }, [])

  useEffect(() => {
    const handleSelectedBook = async () => {
      // setting a new book, so clear all and get html from cache if exists
      const title = catalogEntry.ingredients.filter(ingredient => ingredient.identifier == bookId).map(ingredient=>ingredient.title)[0] || bookId
      setBookTitle(title)
      if (bookId in htmlCache) {
        setHtmlSections({...setHtmlSections, cover: `<h3>${title}</h3>`, body: htmlCache[bookId]})
      } else if (supportedBooks.includes(bookId)) {
        setStatusMessage(<>Preparing preview for {title}.<br/>Please wait...</>)
        setTsvText("")
        setHtmlSections({...htmlSections, body: ""})
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
      let html = `
<section class="tn-book" id="${bookId}" data-toc-title="${bookTitle}">
  <h1 style="text-align: center">${catalogEntry.title}</h1>
`
      let prevChapter = ""
      let prevVerse = ""
      const usfmJSON = usfm.toJSON(targetUsfm)
      const md = new MarkdownIt()
      const supportReferences = {}
      let hasIntro = false

      renderedTsvData.forEach(row => {
        if (!row || !row.ID || !row.Note) {
          return
        }
        const chapterStr = row.Reference.split(":")[0]
        const verseStr = row.Reference.split(":")[1]
        const firstVerse = verseStr.split(",")[0].split("-")[0].split("–")[0]
        if (chapterStr != prevChapter) {
          if (prevChapter) {
            html += `
    </section>
  </section>
`
          }
          html += `
  <section class="book-chapter" id="${bookId}-${chapterStr}" data-toc-title="${bookTitle} ${chapterStr}">
`
        }
        if (chapterStr != prevChapter || firstVerse != prevVerse) {
          if (chapterStr == prevChapter) {
            html += `
    </section>
`
          }
          html += `
    <section class="tn-verse" id="${bookId}-${chapterStr}-${firstVerse}">
`
          if (chapterStr != "front" && firstVerse != "intro" && firstVerse in usfmJSON.chapters[chapterStr]) {
            const scripture = verseObjectsToString(usfmJSON.chapters[chapterStr][firstVerse].verseObjects)
            html += `
      <article class="tn-scripture" id="${bookId}-${chapterStr}-${verseStr}-scripture">
        <h2 class="tn-scripture-header">${bookTitle} ${chapterStr}:${firstVerse}</h2>
        <div class="tn-scripture-verse">
          <p>
            <span style="font-weight: bold">${targetCatalogEntry.abbreviation.toUpperCase()}</span>: 
            <em>${scripture}</em>
          </p>
        </div>
        <hr style="width: 75%"/>
      </article>
`
          }
        }

        html += `
      <article class="tn-entry" id="${bibleReferenceState.bookId}-${chapterStr}-${verseStr}-${row.ID}">
`
        if ((chapterStr != "front" || verseStr != "intro") && (row.GLQuote || row.Quote)) {
          html += `
        <h3 class="tn-entry-header">
          ${verseStr != firstVerse ? `(${chapterStr}:${verseStr}) ` : ""}${row.GLQuote || '<span style="color: red"> ORIG QUOTE: '+row.Quote+'</span>'}
        </h3>
`
          if (row.SupportReference) {
            if (! (row.SupportReference in supportReferences)) {
              supportReferences[row.SupportReference] = {
                backRefs: [],
                title: "",
                html: "",
              }
            }
            supportReferences[row.SupportReference].backRefs.push(`<a href="#${row.ID}">${row.Reference}</a>`)
            html += `
          <div class="tn-note-support-reference">
            <span style="font-weight: bold">Support Reference:</span> [[${row.SupportReference}]]
          </div>
  `
          }
        }
        html += `
          <div class="tn-entry-body">
            ${md.render(row.Note.replaceAll("\\n", "\n").replaceAll("<br>", "\n"))}
          </div>
          <hr style="width: 75%"/>
        </article>
`
        prevChapter = chapterStr
        prevVerse = firstVerse
      })

      html += `
    </section>
  </section>
</section>
`

      const taCatalogEntry = relationCatalogEntries.filter(entry => entry.subject == "Translation Academy")[0]
      if (taCatalogEntry) {
        // populateSupportReferences(supportReferences, taCatalogEntry)
      }

      setHtmlSections({...htmlSections, cover: `<h3>${bookTitle}</h3>`, body: html})
      setHtmlCache({...htmlCache, [bookIdToProcess]: html})
    }

    if (targetCatalogEntry && renderedTsvData && glQuotesReady) {
      generateHtml()
    }
  }, [targetCatalogEntry, renderedTsvData, glQuotesReady])

  return (
    <BibleReference
      status={bibleReferenceState}
      actions={bibleReferenceActions}
      style={{minWidth: "auto"}}
    />
  )
}

RcTranslationNotes.propTypes = {
  urlInfo: PropTypes.object.isRequired,
  catalogEntry: PropTypes.object.isRequired,
  setStatusMessage: PropTypes.func,
  setErrorMessage: PropTypes.func,
  setHtml: PropTypes.func,
  setWebCss: PropTypes.func,
  setPrintCss: PropTypes.func,
  setCanChangeColumns: PropTypes.func,
  updateUrlHashInAddressBar: PropTypes.func,
}
