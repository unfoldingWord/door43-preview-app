import { useEffect } from 'react'
import PropTypes from 'prop-types'
import DOMPurify from 'dompurify'
import { useBibleReference } from 'bible-reference-rcl'
import useGenerateOpenBibleStoriesHtml from '../hooks/useGenerateOpenBibleStoriesHtml'
import BibleReferencePrintBar from '@libs/core/components/bibleReferencePrintBar'
import useFetchZipFileData from '@libs/core/hooks/useFetchZipFileData'

export default function OpenBibleStories({
  urlInfo,
  catalogEntry,
  updateUrlHashInAddressBar,
  setStatusMessage,
  setErrorMessage,
  setPrintHtml,
  onPrintClick,
}) {
  const onBibleReferenceChange = (b, c, v) => {
    c = parseInt(c)
    v = parseInt(v)
    const verseEl = document.getElementById(`${b}-${c}-${v}`)
    if (verseEl) {
      window.scrollTo({
        top: verseEl.getBoundingClientRect().top + window.scrollY - 80,
        behavior: "smooth",
      })
    }
    if (updateUrlHashInAddressBar) {
      updateUrlHashInAddressBar([b, c, v])
    }
  }

  const { state: bibleReferenceState, actions: bibleReferenceActions } =
    useBibleReference({
      initialBook: "obs",
      initialChapter: urlInfo.hashParts[1] || "1",
      initialVerse: urlInfo.hashParts[2] || "1",
      onChange: onBibleReferenceChange,
      addOBS: true,
    })

  let zipFileData = null
  try {
    zipFileData = useFetchZipFileData({catalogEntry})
  } catch (e) {
    setErrorMessage(e.message)
  }

  let html = ""
  try {
    html = useGenerateOpenBibleStoriesHtml({ catalogEntry, zipFileData, setErrorMessage })
  } catch (e) {
    setErrorMessage(e.message)
  }

  useEffect(() => {
    setStatusMessage(<>Preparing OBS Preview.<br/>Please wait...</>)
    bibleReferenceActions.applyBooksFilter("obs")
  }, [])

  useEffect(() => {
    // Handle Print Preview & Status & Navigation
    if (html) {
      setPrintHtml(html)
      setStatusMessage("")
      Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise((resolve) => {
                img.onload = img.onerror = resolve
              })
          )
      ).then(() => {
        bibleReferenceActions.goToBookChapterVerse(
          bibleReferenceState.bookId,
          bibleReferenceState.chapter,
          bibleReferenceState.verse
        )
      })
    }
  }, [html])

  return (
    <>
      <BibleReferencePrintBar 
        bibleReferenceState={bibleReferenceState} 
        bibleReferenceActions={bibleReferenceActions}
        onPrintClick={onPrintClick} 
        printEnabled={html != ""} />
      {html && (
        <div
          style={{
            direction: catalogEntry ? catalogEntry.language_direction : "ltr",
          }}
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(html),
          }}
        />
      )}
    </>
  )
}

OpenBibleStories.propTypes = {
  urlInfo: PropTypes.object,
  catalogEntry: PropTypes.object,
  updateUrlHashInAddressBar: PropTypes.func,
  setStatusMessage: PropTypes.func,
  setErrorMessage: PropTypes.func,
  setCanChangeColumns: PropTypes.func,
  setPrintHtml: PropTypes.func,
  onPrintClick: PropTypes.func,
}
