import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useBibleReference } from 'bible-reference-rcl'
import { BibleBookData } from '@common/books'
import { getSupportedBooks } from '@libs/core/lib/books'
import BibleReference from 'bible-reference-rcl'
import { getRepoContentsContent, getRepoGitTrees } from '@libs/core/lib/dcsApi'
import useFetchRelationCatalogEntries from '@libs/core/hooks/useFetchRelationCatalogEntries'
import useFetchBookFileBySubject from '@libs/core/hooks/useFetchBookFileBySubject'
import usfm from 'usfm-js'
import MarkdownIt from 'markdown-it'
import { verseObjectsToString } from 'uw-quote-helpers'
import Papa from 'papaparse'

const webCss = `
.tq-question {
  font-weight: bold;
}

article + article {
  page-break-before: avoid !important;
  break-brefore: avoid !important;
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

  const { relationCatalogEntries } = useFetchRelationCatalogEntries({
    catalogEntry,
  })

  const { fileContents: targetUsfm, catalogEntry: targetCatalogEntry } = useFetchBookFileBySubject({
    catalogEntries: relationCatalogEntries,
    bookId: bookIdToProcess,
    subject: "Aligned Bible",
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
<section class="bible-book" id="${bookId}" data-toc-title="${bookTitle}">
  <h1 style="text-align: center">${catalogEntry.title}</h1>
`
      let prevChapter = ""
      let prevVerse = ""
      const usfmJSON = usfm.toJSON(targetUsfm)
      const md = new MarkdownIt()

      const rows = Papa.parse(tsvText, {delimiter: '\t', header: true}).data

      rows.forEach((row) => {
        if (!row || !row.ID || !row.Question || !row.Response) {
          return
        }
        const chapterStr = row.Reference.split(":")[0]
        const verseStr = row.Reference.split(":")[1]
        const link = `${bibleReferenceState.bookId}-${chapterStr}-${verseStr}`
        if (chapterStr != prevChapter) {
          if (prevChapter) {
            html += `
</section>
`
          }
          html += `
<section class="book-chapter" id="${bookId}-${chapterStr}" data-toc-title="${bookTitle} ${chapterStr}">
`
        }
        html += `<article class="tq-entry" id="${link}">`
        if (chapterStr != prevChapter || verseStr != prevVerse) {
          const firstVerse = verseStr.split(",")[0].split("-")[0].split("–")[0]
          if (firstVerse != prevVerse) {
            html += `<h2 class="tq-chapter-header">${chapterStr}:${verseStr}</h2>`
          } else {
            html += `<h2>${chapterStr}:${verseStr}</h2>`
          }
          let scripture = ""
          if (usfmJSON.chapters[chapterStr][firstVerse]?.verseObjects) {
            scripture = verseObjectsToString(
              usfmJSON.chapters[chapterStr][firstVerse]?.verseObjects
            )
          }
          html += `<span class="header-title">${bookTitle} ${chapterStr}:${verseStr}</span>`
          html += `<div class="tq-chapter-verse-scripture"><p><span style="font-weight: bold">${targetCatalogEntry.abbreviation.toUpperCase()}</span>: <em>${scripture}</em></p></div><hr style="width: 75%"/>`
          prevChapter = chapterStr
          prevVerse = verseStr
        }
        html += `
        <div class="tq-question">
            ${md.render(row.Question.replaceAll("\\n", "\n").replaceAll("<br>", "\n"))}
        </div>
        <div class="tq-responpse">
            ${md.render(row.Response.replaceAll("\\n", "\n").replaceAll("<br>", "\n"))}
        </div>
        <hr style="width: 75%"/>
      </article>`
      })
      html += `
  </section>
</section>
`
      setHtmlSections({...htmlSections, body: html})
      setHtmlCache({...htmlCache, [bookIdToProcess]: html})
    }

    if (targetCatalogEntry && tsvText && targetUsfm) {
      generateHtml()
    }
  }, [targetCatalogEntry, tsvText, targetUsfm])

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
