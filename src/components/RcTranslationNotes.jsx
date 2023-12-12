import { useState, useEffect, useContext } from "react";
import PropTypes from 'prop-types';
import Typography from "@mui/joy/Typography";
import useTsvGLQuoteAdder from "../hooks/useTsvGLQuoteAdder.jsx";
import DOMPurify from "dompurify";
import CircularProgressUI from "@mui/joy/CircularProgress";
import usfm from "usfm-js";
import { verseObjectsToString } from "uw-quote-helpers";
import {
  getLtrPreviewStyle,
  getRtlPreviewStyle,
} from "../lib/previewStyling.js";
import { decodeBase64ToUtf8 } from "../utils/base64Decode";
import { API_PATH } from "../common/constants";
import BibleReference, { useBibleReference } from 'bible-reference-rcl';
import { ALL_BIBLE_BOOKS, BIBLE_BOOKS, BIBLES_ABBRV_INDEX } from "../common/BooksOfTheBible.js";
import { redirectToUrl } from "../utils/url.js"
import { getRelationCatalogEntries } from "../lib/dcsCatalog.js";
import markdown from '../lib/drawdown'

export default function RcTranslationNotes({
    urlInfo,
    serverInfo,
    catalogEntry,
    setErrorMessage,
    setPrintHtml,
    setCanChangeColumns,
    updateUrlHotlink,
}) {
  const [loading, setLoading] = useState(true)
  const [tsvText, setTsvText] = useState()
  const [html, setHtml] = useState()
  const [relationEntries, setRelationEntries] = useState()
  const [sourceUsfm, setSourceUsfm] = useState()
  const [targetUsfm, setTargetUsfm] = useState()
  const [targetBibleCatalogEntry, setTargetBibleCatalogEntry] = useState()

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

  const onBibleReferencePreChange = (b) => {
    if (b != bibleReferenceState.bookId) {
        redirectToUrl({...urlInfo, extraPath: [b]})
        return false
    }
    return true
  }

  const onBibleReferenceChange = (b, c, v) => {
    c = parseInt(c)
    v = parseInt(v)
    if (c > 1 || v > 1) {
        window.scrollTo({top: document.getElementById(`chapter-${c}-verse-${v}`)?.getBoundingClientRect().top + window.scrollY - 130, behavior: "smooth"})
    } else {
        window.scrollTo({top: 0, behavior: "smooth"})
    }
    let extraPath = [b]
    if (c != 1 || v != 1 || urlInfo.extraPath[1] || urlInfo.extraPath[2]) {
        extraPath = [b, c, v]
    }
    updateUrlHotlink({...urlInfo, extraPath})
  }

  const supportedBooks = catalogEntry.ingredients.map(ingredient => ingredient.identifier.toLowerCase()).filter(id => id in ALL_BIBLE_BOOKS)
  if(! supportedBooks) {
    setErrorMessage("There are no books in this resource to render")
    return
  }

  const book = urlInfo.extraPath[0]?.toLowerCase() || supportedBooks[0]
  if (!supportedBooks.includes(book)) {
    setErrorMessage(`Invalid book. ${book} is not an existing book in this resource.`)
    return
  }

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: book,
    initialChapter: urlInfo.extraPath[1] || "1",
    initialVerse: urlInfo.extraPath[2] || "1",
    onChange: onBibleReferenceChange,
    onPreChange: onBibleReferencePreChange,
  })
  if (supportedBooks.length != 66) {
      bibleReferenceActions.applyBooksFilter(supportedBooks)
  }

  const { renderedData: renderedTsvData, ready: glQuotesReady } = useTsvGLQuoteAdder({
    tsvText,
    sourceUsfm,
    targetUsfm,
  })

  useEffect(() => {
    const loadMetadata = async () => {
      const metadataUrl = `${serverInfo.baseUrl}/${API_PATH}/catalog/metadata/${catalogEntry.owner}/${catalogEntry.repo.name}/${catalogEntry.branch_or_tag_name}`
      try {
        const response = await fetch(metadataUrl)
        if (!response.ok) {
          const text = await response.text()
          throw Error(text)
        }
        const metadata = await response.json()
        if(!metadata) {
          throw new Error("No manifest.yaml file found for this resource.")
        }

        if (!metadata?.dublin_core?.relation) {
          throw new Error("There is no dublin_core.relation property in the manifest.yaml file.")
        }

        const _relationEntries = await getRelationCatalogEntries(serverInfo.baseUrl, API_PATH, metadata.dublin_core.relation, [catalogEntry.repo.owner.username, 'unfoldingword', 'door43-catalog'], catalogEntry.stage)
        setRelationEntries(_relationEntries)
      } catch (error) {
        setErrorMessage(error?.message)
      }
    }

    if (loading && catalogEntry && serverInfo.baseUrl) {
      loadMetadata()
    }
  }, [loading, catalogEntry, serverInfo.baseUrl])

  useEffect(() => {
    const loadSourceUsfm = async () => {
      let sourceSubject = ""
      if (bibleReferenceState.bookId in BIBLE_BOOKS.oldTestament) {
        sourceSubject= "Hebrew Old Testament"
      } else {
        sourceSubject = "Greek New Testament"
      }
      let sourceEntry = null
      relationEntries.forEach(entry => {
        if (!sourceEntry && entry.subject == sourceSubject) {
          sourceEntry = entry
        }
      })
      if (!sourceEntry) {
        setErrorMessage(`No relation found of subject \`${sourceSubject}\` in this resource's manfest.yaml file.`)
        return
      }
      if (!sourceEntry.ingredients.filter(ingredient => ingredient.identifier != bibleReferenceState.bookId).length){
        setErrorMessage(`The source resource, ${catalogEntry.full_name}, does not include the book \`${bibleReferenceState.bookId}\`.`)
        return
      }
      const sourceUsfmUrl = `${serverInfo.baseUrl}/${API_PATH}/repos/${sourceEntry.full_name}/contents/${BIBLES_ABBRV_INDEX[bibleReferenceState.bookId]}-${bibleReferenceState.bookId.toUpperCase()}.usfm?ref=${sourceEntry.branch_or_tag_name}`
      try {
        const response = await fetch(sourceUsfmUrl)
        if (!response.ok) {
          const text = await response.text()
          throw Error(text)
        }
        const jsonResponse = await response.json()
        if (jsonResponse?.content) {
          setSourceUsfm(decodeBase64ToUtf8(jsonResponse.content))
        }
      } catch (error) {
        setErrorMessage(error?.message)
        return
      }
    }

    if (loading && catalogEntry && relationEntries && serverInfo.baseUrl && ! sourceUsfm) {
      loadSourceUsfm()
    }
  }, [loading, catalogEntry, relationEntries, serverInfo.baseUrl])

  useEffect(() => {
    const loadTargetUsfm = async () => {
      let targetEntry = null
      relationEntries.forEach(entry => {
        if (!targetEntry && entry.subject == "Aligned Bible") {
          targetEntry = entry
        }
      })
      if (!targetEntry) {
        setErrorMessage(`No relation found of subject \`Aligned Bible\` in this resource's manifest.yaml file.`)
        return
      }
      let _targetUsfm = ""
      if (!targetEntry.ingredients.filter(ingredient => ingredient.identifier != bibleReferenceState.bookId).length){
        setErrorMessage(`The aligned Bible resource, ${targetEntry.full_name}, does not include the book \`${bibleReferenceState.bookId}\`.`)
        return
      }
      setTargetBibleCatalogEntry(targetEntry)
      const targetUsfmUrl = `${serverInfo.baseUrl}/${API_PATH}/repos/${targetEntry.full_name}/contents/${BIBLES_ABBRV_INDEX[bibleReferenceState.bookId]}-${bibleReferenceState.bookId.toUpperCase()}.usfm?ref=${targetEntry.branch_or_tag_name}`
      try {
        const response = await fetch(targetUsfmUrl)
        if (!response.ok) {
          const text = await response.text()
          throw Error(text)
        }
        const jsonResponse = await response.json()
        if (jsonResponse?.content) {
          setTargetUsfm(decodeBase64ToUtf8(jsonResponse.content))
       }
      } catch (error) {
        setErrorMessage(error?.message)
        return
      } 
    }

    if (loading && catalogEntry && relationEntries && serverInfo.baseUrl && ! sourceUsfm) {
      loadTargetUsfm()
    }
  }, [loading, catalogEntry, relationEntries, serverInfo.baseUrl])

  useEffect(() => {
    const loadTsvFile = async () => {
      let filePath = null
      for (let i = 0; i < catalogEntry.ingredients.length; ++i) {
        const ingredient = catalogEntry.ingredients[i]
        if (ingredient.identifier == bibleReferenceState.bookId) {
          filePath = ingredient.path
          break
        }
      }
      if (!filePath) {
        setErrorMessage("Book not supported")
        return
      }
      
      const tsvURL = `${serverInfo.baseUrl}/${API_PATH}/repos/${catalogEntry.owner}/${catalogEntry.repo.name}/contents/${filePath}?ref=${catalogEntry.commit_sha}`
      try {
        const response = await fetch(tsvURL)
        if (!response.ok) {
          const text = await response.text()
          throw Error(text)
        }

        const jsonResponse = await response.json()
        if (jsonResponse?.content) {
          const _tsvText = decodeBase64ToUtf8(jsonResponse.content)
          setTsvText(_tsvText)
        }
      } catch (error) {
        setErrorMessage(error?.message)
      }
    }

    if (loading && catalogEntry && bibleReferenceState && serverInfo.baseUrl && !tsvText) {
      loadTsvFile()
    }
  }, [loading, catalogEntry, bibleReferenceState, serverInfo.baseUrl])

  useEffect(() => {
    const generateHtml = async () => {
      let _html = `<h1 style="text-align: center">${catalogEntry.title}</h1>\n`
      let prevChapter = ""
      let prevVerse = ""
      const usfmJSON  = usfm.toJSON(targetUsfm)

      renderedTsvData.forEach(row => {
        if (!row || !row.ID || !row.Note) {
          return
        }
        const chapterStr = row.Reference.split(':')[0]
        const verseStr = row.Reference.split(':')[1]
        _html += `<article class="tn-note">`
        if(chapterStr != "front" && verseStr == "intro") {
          _html += `<span id="chapter-${chapterStr}-verse-1"></span>`
        }
        if (chapterStr != prevChapter || verseStr != prevVerse) {
          const firstVerse = verseStr.split('-')[0]
          if (chapterStr != "front" && firstVerse != "intro") {
            if (firstVerse != prevVerse) {
              _html += `<h2 id="chapter-${chapterStr}-verse-${firstVerse}" class="tn-chapter-header">${chapterStr}:${verseStr}</h2>`
            } else {
              _html += `<h2>${chapterStr}:${verseStr}</h2>`
            }
            const scripture = verseObjectsToString(usfmJSON.chapters[parseInt(chapterStr)][parseInt(firstVerse)].verseObjects)
            _html += `<div class="tn-chapter-verse-scripture"><span style="font-weight: bold">${targetBibleCatalogEntry.abbreviation.toUpperCase()}</span>: <em>${scripture}</em></div>`
          }
          prevChapter = chapterStr
          prevVerse = verseStr
        }
        if (row.GLQuote || row.Quote) {
          _html += `<h3 class="tn-note-header">${row.GLQuote || row.Quote}</h3>`
        }
        _html += `<div class="tn-note-body">${markdown(row.Note.replaceAll("\\n", "\n"))}</div>
            <hr style="width: 75%"/>
          </article>`
      })
      setHtml(_html)
      setPrintHtml(_html)
      setLoading(false)
    }

    if(loading && targetBibleCatalogEntry && glQuotesReady && renderedTsvData && ! html) {
      generateHtml()
    }
  }, [loading, targetBibleCatalogEntry, renderedTsvData, glQuotesReady])

  useEffect(() => {
    if (html) {
      bibleReferenceActions.goToBookChapterVerse(bibleReferenceState.bookId, bibleReferenceState.chapter, bibleReferenceState.verse)
    }
  }, [html])

  return (
    <>
      {loading ? (
        <>
          <Typography color="textPrimary" gutterBottom display="inline">
            <>Loading file from server... </>
          </Typography>
          <CircularProgressUI />
        </>
      ) : html ? (
        <>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', position: "sticky", "top": "60px", background: "inherit", padding: "10px"}}>
            <BibleReference status={bibleReferenceState} actions={bibleReferenceActions}/>
          </div>
          <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(html),
            }}
          />
        </>
      ) : (
        <>
          <Typography color="textPrimary" gutterBottom display="inline">
            <>Converting file... </>
          </Typography>
          <CircularProgressUI />
        </>
      )}
    </>
  )
}

RcTranslationNotes.propTypes = {
  urlInfo: PropTypes.object,
  serverInfo: PropTypes.object,
  catalogEntry: PropTypes.object,
  setErrorMessage: PropTypes.func,
  setPrintHtml: PropTypes.func,
  setCanChangeColumns: PropTypes.func,
  updateUrlHotlink: PropTypes.func,
}