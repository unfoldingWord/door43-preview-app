import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useBibleReference } from 'bible-reference-rcl'
import { BibleBookData } from '@common/books'
import { getSupportedBooks } from '@libs/core/lib/books'
import BibleReference from 'bible-reference-rcl'
import { getRepoContentsContent, getRepoGitTrees } from '@libs/core/lib/dcsApi'
import useFetchRelationCatalogEntries from '@libs/core/hooks/useFetchRelationCatalogEntries'
import useFetchCatalogEntryBySubject from '@libs/core/hooks/useFetchCatalogEntryBySubject'
import useFetchBookFile from '@libs/core/hooks/useFetchBookFile'
import usfm from 'usfm-js'
import { verseObjectsToString } from 'uw-quote-helpers'
import Papa from 'papaparse'


const webCss = `
.tq-question {
  font-weight: bold;
}

.tq-entry h1 {
  font-size: 1.4em;
  margin: 10px 0;
}

.tq-entry h2 {
  font-size: 1.2em;
  margin: 10px 0;
}

.tq-entry h3, .tq-entry h4 {
  font-size: 1.1em;
  margin: 10px 0;
}

hr {
  break-before: avoid !important;
}

article.tq-scripture,
article.tq-entry,
section.tq-verse {
  break-before: auto !important;
  break-inside: avoid !important;
  break-after: auto !important
}

section.book-chapter {
  break-after: page !important;
}

a.header-link {
  font-weight: inherit !important;
  font-size: inherit !important;
  color: #000000;
  text-decoration: none;
}

a.header-link:hover::after {
  content: "#";
  padding-left: 5px;
  color: blue;
  display: inline-block;
}

.tq-entry-show-checkbox + .tq-entry-response {
  display:none;
}

#tq-entry-show-checkbox:checked + .tq-entry-response {
  display:block;
}
`

export default function RcTranslationQuestions({
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

  const relationCatalogEntries = useFetchRelationCatalogEntries({
    catalogEntry,
  })

  const targetBibleCatalogEntry = useFetchCatalogEntryBySubject({
    catalogEntries: relationCatalogEntries,
    subject: "Aligned Bible",
    bookId: bookIdToProcess,
  })

  const targetUsfm = useFetchBookFile({
    catalogEntry: targetBibleCatalogEntry,
    bookId: bookIdToProcess,
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
        setHtmlSections({...setHtmlSections, cover: `<h3 class="cover-book-title">${title}</h3>`, body: htmlCache[bookId]})
      } else if (supportedBooks.includes(bookId)) {
        setStatusMessage(<>Preparing preview for {title}.<br/>Please wait...</>)
        setTsvText("")
        setHtmlSections({...htmlSections, cover: `<h3 class="cover-book-title">${title}</h3>`, body: ""})
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
<section class="tq-book" id="${bookId}" data-toc-title="${bookTitle}">
  <h1 style="text-align: center">${catalogEntry.title}</h1>
`
      let prevChapter = ""
      let prevVerse = ""
      const usfmJSON = usfm.toJSON(targetUsfm)
      const rows = Papa.parse(tsvText, {delimiter: '\t', header: true}).data

      rows.forEach(row => {
        if (!row || !row.ID || !row.Question || !row.Response) {
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
    <h2>
      <a class="header-link" href="#${bookId}-${chapterStr}">
        ${bookTitle} ${chapterStr}
      </a>
    </h2>
`
        }
        if (chapterStr != prevChapter || firstVerse != prevVerse) {
          if (chapterStr == prevChapter) {
            html += `
    </section>
`
          }
          html += `
    <section class="tq-verse" id="${bookId}-${chapterStr}-${firstVerse}">
`
          if (chapterStr in usfmJSON.chapters && firstVerse in usfmJSON.chapters[chapterStr]) {
            const scripture = verseObjectsToString(usfmJSON.chapters[chapterStr][firstVerse].verseObjects)
            const link = `${bookId}-${chapterStr}-${firstVerse}`
            html += `
      <article class="tq-scripture" id="${link}-scripture">
        <h3 class="tq-scripture-header">
          <a class="header-link" href="#${link}">
            ${bookTitle} ${chapterStr}:${firstVerse}
          </a>
        </h3>
        <span class="header-title">${catalogEntry.title} :: ${row.Reference}</span>
        <div class="tq-scripture-verse">
          <p>
            <span style="font-weight: bold">${targetBibleCatalogEntry.abbreviation.toUpperCase()}</span>: 
            <em>${scripture}</em>
          </p>
        </div>
        <hr style="width: 75%"/>
      </article>
`
          }
        }
        if (row.Question && row.Response) {
          const link = `${bibleReferenceState.bookId}-${chapterStr}-${firstVerse}-${row.ID}`
          html += `
      <article class="tq-entry" id="${link}">
        <h4 class="tq-entry-question">
          <a class="header-link" href="#${link}">
            ${verseStr != firstVerse ? `(${chapterStr}:${verseStr}) ` : ""}${row.Question}
          </a>
        </h4>
        <label class="tq-entry-show-label">
          <i class="arrow down"></i>
        </label>
        <input type="checkbox" id="tq-entry-show-checkbox" style="display:none;">
        <div class="tq-entry-response">
          ${row.Response}
        </div>
        <hr style="width: 75%"/>
      </article>
`
        }
        prevChapter = chapterStr
        prevVerse = firstVerse
      })

      html += `
    </section>
  </section>
</section>
`
      setHtmlSections({...htmlSections, body: html})
      setHtmlCache({...htmlCache, [bookIdToProcess]: html})
    }

    if (targetBibleCatalogEntry && tsvText && targetUsfm) {
      generateHtml()
    }
  }, [targetBibleCatalogEntry, tsvText, targetUsfm])

  return (
    <BibleReference
      status={bibleReferenceState}
      actions={bibleReferenceActions}
      style={{minWidth: "auto"}}
    />
  )
}

RcTranslationQuestions.propTypes = {
  urlInfo: PropTypes.object.isRequired,
  catalogEntry: PropTypes.object.isRequired,
  setStatusMessage: PropTypes.func,
  setErrorMessage: PropTypes.func,
  setHtmlSections: PropTypes.func,
  setWebCss: PropTypes.func,
  setPrintCss: PropTypes.func,
  setCanChangeColumns: PropTypes.func,
  updateUrlHashInAddressBar: PropTypes.func,
}
