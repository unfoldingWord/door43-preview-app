import { useState, useEffect } from 'react'
import { ThemeProvider, createTheme } from '@mui/material'
import PropTypes from 'prop-types'
import useUsfmPreviewRenderer from '../hooks/useUsfmPreviewRender'
import BibleReference from 'bible-reference-rcl'
import {
  getLtrPreviewStyle,
  getRtlPreviewStyle,
} from "@libs/core/lib/previewStyling.js"
import { useBibleReference } from 'bible-reference-rcl'
import { BibleBookData } from '@common/books'
import { getSupportedBooks } from '@libs/core/lib/books'
import { getRepoContentsContent, getRepoGitTrees } from '@libs/core/lib/dcsApi'

const theme = createTheme({
  overrides: {
    MuiInput: {
      outline: {

        "&:hover:not(.Mui-disabled):before": {
          borderBottom: "2px solid white",
        },
        "&:before": {
          borderBottom: "1px solid white",
        },
        "&:after": {
          borderBottom: "2px solid white",
        },
      },
    },
  },
});

const webCss = `
h1 {
  column-span: all;
}

.new-page {
  break-after: page;
  column-span: all;
}
`

const printCss = `
@page {
  @footnote { 
    float: bottom;
    border-top: solid black 1px;
    padding-top: 1em;
    margin-top: 1em;
 }
}

span.footnote {
  float: footnote;
  position: note(footnotes);
}
  
::footnote-call { 
  font-weight: 700;
  font-size: 1em;
  line-height: 0; 
}
  
::footnote-marker {
  /* content: counter(footnote, lower-alpha) ". "; */
  font-weight: 700;
  line-height: 0; 
  font-style: italic !important;
}

.pagedjs_footnote_area * {
  background-color: white !important;
}

a.footnote {
  font-style: italic !important;
}
`

export default function Bible({
  urlInfo,
  catalogEntry,
  htmlSections,
  setStatusMessage,
  setErrorMessage,
  setHtmlSections,
  setWebCss,
  setPrintCss,
  setCanChangeColumns,
  setDocumentAnchor,
}) {
  const [supportedBooks, setSupportedBooks] = useState([])
  const [bookId, setBookId] = useState()
  const [bookTitle, setBookTitle] = useState()
  const [bookIdToProcess, setBookIdToProcess] = useState()
  const [usfmText, setUsfmText] = useState()
  const [htmlCache, setHtmlCache] = useState({})

  const renderFlags = {
    showWordAtts: false,
    showTitles: true,
    showHeadings: true,
    showIntroductions: true,
    showFootnotes: true,
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
    } else if (setDocumentAnchor) {
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
        console.log(`Error calling etRepoGitTrees(${catalogEntry.repo.url}, ${catalogEntry.branch_or_tag_name}, true): `, e)
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
        return
      }
      setCanChangeColumns(true)
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
        const title = catalogEntry.ingredients.filter(ingredient => ingredient.identifier == bookId).map(ingredient=>ingredient.title)[0] || bookId
        setBookTitle(title)
        setStatusMessage(<>Preparing preview for {title}.<br/>Please wait...</>)
        setUsfmText("")
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
        console.log(`Error calling getRepoContents(${catalogEntry.repo.url}, ${filePath}, ${catalogEntry.commit_sha}): `, e)
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
      _html = _html.replaceAll(/ id="chapter-(\d+)"/gi, ` id="${bookId}-$1" data-toc-title="${bookTitle} $1"`)
      _html = _html.replaceAll(/<span([^>]+style="[^">]+#CCC[^">]+")/gi, `<span$1 class="footnote"`)
      _html = `<section class="bible-book" id="${bookId}" data-toc-title="${bookTitle}">${_html}</section>`
      setHtmlSections({...htmlSections, cover: `<h3 class="cover-book-title">${bookTitle}</h3>`, toc: "", body: _html})
      setStatusMessage("")
      setWebCss(webCss)
      setPrintCss(printCss)
      if (!(bookIdToProcess in htmlCache)) {
        setHtmlCache({ ...htmlCache, [bookIdToProcess]: _html })
      }
    }

    if (htmlReady && renderedData && !(bookIdToProcess in htmlCache)) {
      handleRenderedDataFromUsfmToHtmlHook()
    }
  }, [htmlReady, renderedData])

  return (
    <ThemeProvider theme={theme}>
      <BibleReference
        status={bibleReferenceState}
        actions={bibleReferenceActions} />
    </ThemeProvider>
  )
}
