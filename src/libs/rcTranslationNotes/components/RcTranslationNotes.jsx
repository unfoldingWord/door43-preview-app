import { useState, useEffect } from "react";
import PropTypes from 'prop-types';
import Typography from "@mui/joy/Typography";
import useTsvGLQuoteAdder from "../../core/hooks/useTsvGLQuoteAdder.jsx";
import useFetchRelationCatalogEntries from "../../core/hooks/useFetchRelationCatalogEntries.jsx"
import DOMPurify from "dompurify";
import CircularProgressUI from "@mui/joy/CircularProgress";
import usfm from "usfm-js";
import { verseObjectsToString } from "uw-quote-helpers";
import BibleReference, { useBibleReference } from 'bible-reference-rcl';
import useFetchTargetUsfm from "../../core/hooks/useFetchTargetUsfm.jsx";
import useFetchSourceUsfm from "../../core/hooks/useFetchSourceUsfm.jsx";
import MarkdownIt from "markdown-it";
import { getSupportedBooks } from "../../core/lib/books.js";


export default function RcTranslationNotes({
    urlInfo,
    catalogEntry,
    zipFileData,
    setErrorMessage,
    updateUrlHashLink,
    setPrintHtml,
}) {
  const [supportedBooks, setSupportedBooks] = useState([])
  const [tsvText, setTsvText] = useState()
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
      setTsvText(null)
      setHtml(null)
      return
    }
    c = parseInt(c)
    v = parseInt(v)
    if (c > 1 || v > 1) {
        window.scrollTo({top: document.getElementById(`${b}-${c}-${v}`)?.getBoundingClientRect().top + window.scrollY - 140, behavior: "smooth"})
    } else {
        window.scrollTo({top: 0, behavior: "smooth"})
    }
    if (updateUrlHashLink) {
      let hashParts = [b]
      if (c != 1 || v != 1 || urlInfo.hashParts[1] || urlInfo.hashParts[2]) {
        hashParts = [b, c, v]
      }
      updateUrlHashLink(hashParts)
    }
  }

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook:  urlInfo.hashParts[0] || supportedBooks[0] || "gen",
    initialChapter: urlInfo.hashParts[1] || "1",
    initialVerse: urlInfo.hashParts[2] || "1",
    onChange: onBibleReferenceChange,
  })

  const { relationCatalogEntries } = useFetchRelationCatalogEntries({
    catalogEntry,
  })

  const { sourceUsfm } = useFetchSourceUsfm({
    relationCatalogEntries,
    bookId: bibleReferenceState.bookId,
  })

  const { targetUsfm, targetCatalogEntry } = useFetchTargetUsfm({
    relationCatalogEntries,
    bookId: bibleReferenceState.bookId,
  })

  const { renderedData: renderedTsvData, ready: glQuotesReady } = useTsvGLQuoteAdder({
    tsvText,
    sourceUsfm,
    targetUsfm,
  })

  useEffect(() => {
    const loadSupportedBooks = async () => {
        const sb = getSupportedBooks(catalogEntry, zipFileData)
        if(! sb) {
          setErrorMessage("There are no books in this resource to render")
          setLoading(false)
          return
        }
      
        const book = urlInfo.hashParts[0]?.toLowerCase() || sb[0]
        if (!sb.includes(book)) {
          setErrorMessage(`Invalid book. \`${book}\` is not an existing book in this resource.`)
          setLoading(false)
          return
        }
      
        setSupportedBooks(sb)
        if (sb.length != 66) {
            bibleReferenceActions.applyBooksFilter(sb)
        }        
        bibleReferenceActions.goToBookChapterVerse(book, urlInfo.hashParts[1] || "1", urlInfo.hashParts[2] || "1")
    }

    if(catalogEntry && zipFileData) {
        loadSupportedBooks()
    }
  }, [catalogEntry, zipFileData])

  useEffect(() => {
    const loadTsvFile = async () => {
      let usfmFilePath = null
      for (let i = 0; i < catalogEntry.ingredients.length; ++i) {
        const ingredient = catalogEntry.ingredients[i]
        if (ingredient.identifier == bibleReferenceState.bookId) {
          usfmFilePath = `${catalogEntry.repo.name}/${ingredient.path.replace(/^\./, "")}`
          break
        }
      }
      if (!usfmFilePath) {
        setErrorMessage(`The book \`${bibleReferenceState.bookId}\` is not found as a project in this resource's manifest.yaml file.`)
        return
      }
      if (!(usfmFilePath in zipFileData.files)) {
        setErrorMessage(`The file \`${usfmFilePath}\` does not exist in this resource's files.`)
        return
      }

      try {
        const tsv = await zipFileData.files[usfmFilePath].async('text')
        setTsvText(tsv)
      } catch(e) {
        setErrorMessage(e?.message)
        return
      }
    }

    if (zipFileData && bibleReferenceState?.bookId) {
      console.log("LOADING TSV FILE")
      loadTsvFile()
    }
  }, [zipFileData, bibleReferenceState?.bookId])

  useEffect(() => {
    const generateHtml = async () => {
      let _html = `<h1 style="text-align: center">${catalogEntry.title}</h1>\n`
      let prevChapter = ""
      let prevVerse = ""
      const usfmJSON  = usfm.toJSON(targetUsfm)
      const md = new MarkdownIt()

      renderedTsvData.forEach(row => {
        if (!row || !row.ID || !row.Note) {
          return
        }
        const chapterStr = row.Reference.split(':')[0]
        const verseStr = row.Reference.split(':')[1]
        _html += `<article class="tn-note">`
        if(chapterStr != "front" && verseStr == "intro") {
          _html += `<span id="${bibleReferenceState.bookId}-${chapterStr}-1"></span>`
        }
        if (chapterStr != prevChapter || verseStr != prevVerse) {
          const firstVerse = verseStr.split(',')[0].split('-')[0].split('–')[0]
          if (chapterStr != "front" && firstVerse != "intro") {
            if (firstVerse != prevVerse) {
              _html += `<h2 id="${bibleReferenceState.bookId}-${chapterStr}-${firstVerse}" class="tn-chapter-header">${chapterStr}:${verseStr}</h2>`
            } else {
              _html += `<h2>${chapterStr}:${verseStr}</h2>`
            }
            const scripture = verseObjectsToString(usfmJSON.chapters[chapterStr][firstVerse]?.verseObjects)
            _html += `<div class="tn-chapter-verse-scripture"><span style="font-weight: bold">${targetCatalogEntry.abbreviation.toUpperCase()}</span>: <em>${scripture}</em></div>`
          }
          prevChapter = chapterStr
          prevVerse = verseStr
        }
        if (row.GLQuote || row.Quote) {
          _html += `<h3 class="tn-note-header">${row.GLQuote || row.Quote}</h3>`
        }
        _html += `<div class="tn-note-body">${md.render(row.Note.replaceAll("\\n", "\n").replaceAll('<br>', "\n"))}</div>
            <hr style="width: 75%"/>
          </article>`
      })
      setHtml(_html)
      setPrintHtml(_html)
    }

    if(targetCatalogEntry && renderedTsvData && glQuotesReady) {
      generateHtml()
    }
  }, [targetCatalogEntry, renderedTsvData, glQuotesReady])

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
      {html ? (
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
            <>Converting to HTML... </>
          </Typography>
          <CircularProgressUI />
        </>
      )}
    </>
  )
}

RcTranslationNotes.propTypes = {
  catalogEntry: PropTypes.object,
  zipFileData: PropTypes.object,
  setErrorMessage: PropTypes.func,
  setPrintHtml: PropTypes.func,
  setCanChangeColumns: PropTypes.func,
  updateUrlHashLink: PropTypes.func,
}