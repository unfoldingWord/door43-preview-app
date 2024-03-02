import { useState, useEffect } from 'react'
import { useBibleReference } from 'bible-reference-rcl'
import { BibleBookData } from '@common/books'
import { getSupportedBooks } from '@libs/core/lib/books'
import BibleReference from 'bible-reference-rcl'
import { getRepoContentsContent, getRepoGitTrees } from '@libs/core/lib/dcsApi'
import useFetchRelationCatalogEntries from '@libs/core/hooks/useFetchRelationCatalogEntries'
import useFetchCatalogEntryBySubject from '@libs/core/hooks/useFetchCatalogEntryBySubject'
import useFetchBookFile from '@libs/core/hooks/useFetchBookFile'
import useFetchZipFileData from '@libs/core/hooks/useFetchZipFileData'
import useTsvGLQuoteAdder from '@libs/core/hooks/useTsvGLQuoteAdder'
import useGenerateTranslationAcademyFileContents from '@libs/rcTranslationAcademy/hooks/useGenerateTranslationAcademyFileContents'
import usfm from 'usfm-js'
import MarkdownIt from 'markdown-it'
import { verseObjectsToString } from 'uw-quote-helpers'
import { encodeHTML } from '@utils/html'


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

@media print {
  section.tn-verse,
  section.book-chapter{
    break-after: page;
  }

  article {
    break-after: avoid-page !important;
  }

  hr {
    break-before: avoid-page !important;
  }

  .ta.appendex article {
    break-after: page !important;
  }  
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

.ta.appendex .article-body h1, .article-body h2, .article-body h3, .article-body h4 {
  font-size: 1em;
}

.title-page {
  text-align: center;
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
      setDocumentAnchor(`${b}-${c}-${v}`)
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

  const sourceBibleCatalogEntry = useFetchCatalogEntryBySubject({
    catalogEntries: relationCatalogEntries,
    subject: BibleBookData[bookIdToProcess]?.testament == "old" ? "Hebrew Old Testament" : "Greek New Testament",
    bookId: bookIdToProcess,
    setErrorMessage,
  })

  
  const sourceUsfm = useFetchBookFile({
    catalogEntry: sourceBibleCatalogEntry,
    bookId: bookIdToProcess,
    setErrorMessage,
  })

  const targetBibleCatalogEntry = useFetchCatalogEntryBySubject({
    catalogEntries: relationCatalogEntries,
    subject: "Aligned Bible",
    bookId: bookIdToProcess,
    setErrorMessage,
  })

  const targetUsfm = useFetchBookFile({
    catalogEntry: targetBibleCatalogEntry,
    bookId: bookIdToProcess,
    setErrorMessage,
  })

  const renderedTsvData = useTsvGLQuoteAdder({
    tsvText,
    sourceUsfm,
    targetUsfm,
  })
  
  const taCatalogEntry = useFetchCatalogEntryBySubject({
    catalogEntries: relationCatalogEntries,
    subject: "Translation Academy",
    setErrorMessage,
  })

  const taZipFileData = useFetchZipFileData({
    catalogEntry: taCatalogEntry,
  })

  const taFileContents = useGenerateTranslationAcademyFileContents({
    catalogEntry: taCatalogEntry,
    zipFileData: taZipFileData,
    setErrorMessage: setErrorMessage,
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
          if (chapterStr in usfmJSON.chapters && firstVerse in usfmJSON.chapters[chapterStr]) {
            const scripture = verseObjectsToString(usfmJSON.chapters[chapterStr][firstVerse].verseObjects)
            html += `
      <article class="tn-scripture" id="${bookId}-${chapterStr}-${verseStr}-scripture">
        <h2 class="tn-scripture-header">
          <a href="#${bookId}-${chapterStr}-${verseStr}" class="header-link">${bookTitle} ${chapterStr}:${firstVerse}</a>  
        </h2>
        <span class="header-title">${catalogEntry.title} :: ${bookTitle} ${chapterStr}:${verseStr}</span>
        <div class="tn-scripture-verse">
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

        const link = `${bibleReferenceState.bookId}-${chapterStr}-${verseStr}-${row.ID}`
        html += `
      <article class="tn-entry" id="${link}">
`
        if ((chapterStr != "front" || verseStr != "intro") && (row.GLQuote || row.Quote)) {
          html += `
        <h3 class="tn-entry-header">
          <a class="header-link" href="#${link}">
            ${verseStr != firstVerse ? `(${chapterStr}:${verseStr}) ` : ""}${row.GLQuote || '<span style="color: red"> ORIG QUOTE: '+row.Quote+'</span>'}
          </a>
        </h3>
`
          if (row.SupportReference) {
            if (! (row.SupportReference in supportReferences)) {
              const srParts = row.SupportReference.split('/')
              const manualId = srParts[srParts.length - 2]
              const articleId = srParts[srParts.length - 1]
              supportReferences[row.SupportReference] = {
                backRefs: [],
                title: articleId,
                body: "TA ARTICLE NOT FOUND",
                link: `note--${manualId}--${articleId}`
              }
              if (manualId in taFileContents && articleId in taFileContents[manualId].articles) {
                supportReferences[row.SupportReference] = {...supportReferences[row.SupportReference], ...taFileContents[manualId].articles[articleId]}
              }
            }
            supportReferences[row.SupportReference].backRefs.push(`<a href="#${link}">${row.Reference}</a>`)
            html += `
        <div class="tn-entry-support-reference">
          <span style="font-weight: bold">Support Reference:</span>&nbsp; <a href="#${supportReferences[row.SupportReference].link}">${supportReferences[row.SupportReference].title}</a>
        </div>
  `
          }
        }
        let note = md.render(row.Note.replaceAll("\\n", "\n").replaceAll("<br>", "\n"))
        note = note.replace(/href="\.\/0*([^/".]+)(\.md){0,1}"/g, `href="#${bookId}-${chapterStr}-$1"`)
        note = note.replace(/href="\.\.\/0*([^/".]+)\/0*([^/".]+)(\.md){0,1}"/g, `href="#${bookId}-$1-$2"`)
        note = note.replace(/href="0*([^#/".]+)(\.md){0,1}"/g, `href="#${bookId}-${chapterStr}-$1"`)
        note = note.replace(/href="\/*0*([^#/".]+)\/0*([^/".]+)\.md"/g, `href="#${bookId}-$1-$2"`)
        note = note.replace(/(?<![">])(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/g, '<a href="$1">$1</a>')
        note = note.replace(/(href="http[^"]+")/g, '$1 target="_blank"')

        note = note.replace()
        html += `
        <span class="header-title">${catalogEntry.title} :: ${bookTitle} ${row.Reference}</span>
        <div class="tn-entry-body">
          ${note}
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
<section class="appendex ta" id="notes-ta" data-toc-title="${encodeHTML(taCatalogEntry.title)}">
  <article class="title-page">
    <span class="header-title"></span>
    <img class="title-logo" src="https://cdn.door43.org/assets/uw-icons/logo-uta-256.png" alt="uta">
    <h1 class="cover-header section-header">${taCatalogEntry.title}</h1>
    <h3 class="cover-version">${taCatalogEntry.branch_or_tag_name}</h3>
  </article>  
`
      Object.values(supportReferences).sort((a, b) => a.title.toLowerCase() < b.title.toLowerCase() ? -1 : a.title.toLowerCase() > b.title.toLowerCase() ? 1 : 0).forEach(taArticle => {
        html += `
  <article id="${taArticle.link}" data-toc-title="${encodeHTML(taArticle.title)}">
    <h2 class="header article-header">
      <a href="#${taArticle.link}" class="header-link">${taArticle.title}</a>
    </h2>
    <span class="header-title">${taCatalogEntry.title} :: ${taArticle.title}</span>
    <div class="article-body">
      ${taArticle.body}
    </div>
    <div class="back-refs">
    <h3>TN References:</h3>
    ${taArticle.backRefs.join('; ')}
    <hr style="width: 75%" />
  </article>
`
      })
      html += `
</section>
`
      setHtmlSections({...htmlSections, cover: `<h3>${bookTitle}</h3>`, body: html})
      setHtmlCache({...htmlCache, [bookIdToProcess]: html})
    }

    if (targetBibleCatalogEntry && renderedTsvData && targetUsfm && taFileContents) {
      generateHtml()
    }
  }, [targetBibleCatalogEntry, targetUsfm, renderedTsvData, taFileContents])

  return (
    <BibleReference
      status={bibleReferenceState}
      actions={bibleReferenceActions}
      style={{minWidth: "auto"}}
    />
  )
}
