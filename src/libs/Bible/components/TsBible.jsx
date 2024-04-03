import { useState, useEffect, useContext } from 'react'
import { ThemeProvider, createTheme } from '@mui/material'
import useUsfmPreviewRenderer from '../hooks/useUsfmPreviewRender'
import BibleReference from 'bible-reference-rcl'
import {
  getLtrPreviewStyle,
  getRtlPreviewStyle,
} from "@libs/core/lib/previewStyling.js"
import { useBibleReference } from 'bible-reference-rcl'
import { BibleBookData } from '@common/books'
import { AppContext } from '@components/App.context'
import useFetchZipFileData from '@libs/core/hooks/useFetchZipFileData'
import { ts2usfm } from '@libs/core/lib/ts2usfm'


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

.header-link {
  text-decoration: none;
  color: inherit;
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

export default function TsBible() {
  const {
    state: {
      urlInfo,
      catalogEntry,
      documentAnchor,
    },
    actions: {
      setWebCss,
      setPrintCss,
      setStatusMessage,
      setErrorMessage,
      setHtmlSections,
      setDocumentAnchor,
      setCanChangeColumns,
    },
  } = useContext(AppContext)

  const [supportedBooks, setSupportedBooks] = useState([])
  const [bookId, setBookId] = useState()
  const [bookTitle, setBookTitle] = useState()
  const [usfmText, setUsfmText] = useState()

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
    if (bookId && b != bookId) {
      window.location.hash = b;
      window.location.reload()
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

  const zipFileData = useFetchZipFileData({
    catalogEntry,
    setErrorMessage,
  })

  const { renderedData, ready: htmlReady } = useUsfmPreviewRenderer({
    bookId,
    usfmText,
    renderFlags,
    renderStyles: catalogEntry?.language_direction === "rtl" ? getRtlPreviewStyle() : getLtrPreviewStyle(),
    htmlRender: true,
    setErrorMessage,
  })

  useEffect(() => {
    if (documentAnchor && documentAnchor.split('-').length == 3) {
      const parts = documentAnchor.split('-')
      if(bibleReferenceState.bookId != parts[0] || bibleReferenceState.chapter != parts[1] || bibleReferenceState.verse != parts[2]) {
        bibleReferenceActions.goToBookChapterVerse(parts[0], parts[1], parts[2])
      }
    }
  }, [documentAnchor])

  useEffect(() => {
    const setInitialBookIdAndSupportedBooks = async () => {
      if (!catalogEntry) {
        setErrorMessage("No catalog entry for this resource found.")
        return
      }

      let sb = catalogEntry.ingredients?.map(ingredient => ingredient.identifier) || []

      if (!sb.length) {
        setErrorMessage("No books found for this tS project")
      }

      setSupportedBooks(sb)
      bibleReferenceActions.applyBooksFilter(sb)


      let _bookId = urlInfo.hashParts[0] || sb[0]
      if (! _bookId) {
        setErrorMessage("Unable to determine a book ID to render.")
        return
      }
      const title = catalogEntry.ingredients.filter(ingredient => ingredient.identifier == _bookId).map(ingredient=>ingredient.title)[0] || _bookId
      setBookId(_bookId)
      setBookTitle(title)
      setStatusMessage(<>Preparing preview for {title}.<br/>Please wait...</>)
      if (!sb.includes(_bookId)) {
        setErrorMessage(`This resource does not support the rendering of the book \`${_bookId}\`. Please choose another book to render.`)
        return
      }
      setCanChangeColumns(true)
    }

    if (!bookId) {
      setInitialBookIdAndSupportedBooks()
    }
  }, [bookId, urlInfo, catalogEntry, setCanChangeColumns, setErrorMessage, setSupportedBooks, setBookId, setStatusMessage, setBookTitle])

  useEffect(() => {
    const getUsfmFromZipFileData = async () => {
      if (! (bookId in BibleBookData)) {
        setErrorMessage(`Invalid book: ${bookId}`)
        return
      }

      const ingredient = catalogEntry.ingredients.filter(ingredient => ingredient.identifier == bookId)?.[0]
      console.log(ingredient)
      const _usfmText = await ts2usfm(catalogEntry, ingredient, zipFileData)
      setUsfmText(_usfmText)
    }

    if (catalogEntry && zipFileData && bookId && supportedBooks.includes(bookId)) {
      getUsfmFromZipFileData()
    }
  }, [catalogEntry, bookId, supportedBooks, zipFileData, setErrorMessage])

  useEffect(() => {
    const handleRenderedDataFromUsfmToHtmlHook = async () => {
      let _html = renderedData.replaceAll(
        /<span id="chapter-(\d+)-verse-(\d+)"([^>]*)>(\d+)<\/span>/g,
        `<span id="${bookId}-$1-$2"$3><a href="#${bookId}-$1-$2" class="header-link">$4</a></span>`
      )
      _html = _html.replaceAll(/<span id="chapter-(\d+)" ([^>]+)>([\d]+)<\/span>/gi, `<span id="${bookId}-$1" data-toc-title="${bookTitle} $1" $2><a href="#${bookId}-$1-1" class="header-link">$3</a></span>`)
      _html = _html.replaceAll(/<span([^>]+style="[^">]+#CCC[^">]+")/gi, `<span$1 class="footnote"`)
      _html = `<section class="bible-book" id="${bookId}" data-toc-title="${bookTitle}">${_html}</section>`
      setHtmlSections({cover: `<h3 class="cover-book-title">${bookTitle}</h3>`, toc: "", body: _html})
      setStatusMessage("")
      setWebCss(webCss)
      setPrintCss(printCss)
    }

    if (htmlReady && renderedData) {
      handleRenderedDataFromUsfmToHtmlHook()
    }
  }, [bookId, htmlReady, renderedData, bookTitle, setWebCss, setPrintCss, setHtmlSections, setStatusMessage, setErrorMessage])

  return (
    <ThemeProvider theme={theme}>
      <BibleReference
        status={bibleReferenceState}
        actions={bibleReferenceActions} />
    </ThemeProvider>
  )
}
