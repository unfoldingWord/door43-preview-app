import { useState, useEffect } from "react";
import PropTypes from 'prop-types';
import DOMPurify from "dompurify";
import BibleReference, { useBibleReference } from 'bible-reference-rcl';
import useGenerateRcOpenBibleStoriesHtml from "../hooks/useGenerateRcOpenBibleStoriesHtml";


export default function RcOpenBibleStories({
    urlInfo,
    catalogEntry,
    zipFileData,
    updateUrlHashLink,
    setStatusMessage,
    setPrintHtml,
}) {
  const onBibleReferenceChange = (b, c, v) => {
    const storyNum = parseInt(c)
    const frameNum = parseInt(v)    
    const story = document.getElementById(`obs-${storyNum}-1`)
    if ((storyNum == 1 && frameNum == 1) || ! story) {
        window.scrollTo({top: 0, behavior: "smooth"})
    } else if (story) {
        let frame = story
        if (frameNum > 1 && story.children[frameNum*2]) {
            frame = story.children[frameNum*2-1] // *2 because 2 elements for every frame: image & text; -1 because one title element
        }
        if (frame) {
            window.scrollTo({top: frame.getBoundingClientRect().top + window.scrollY - 150, behavior: "smooth"})
        }
    }
    if (updateUrlHashLink) {
      updateUrlHashLink([b, c, v])
    }
  }
  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: "obs",
    initialChapter: urlInfo.hashParts[1] || "1",
    initialVerse: urlInfo.hashParts[2] || "1",
    onChange: onBibleReferenceChange,
    addOBS: true,
  })

  let html = ""
  try {
    html = useGenerateRcOpenBibleStoriesHtml({catalogEntry, zipFileData})
  } catch(e) {
    setErrorMessage(e?.message)
  }

  useEffect(() => {
    setStatusMessage("Preparing OBS Preview. Please wait...")
    bibleReferenceActions.applyBooksFilter("obs")
  }, [])

  useEffect(() => {
    // Handle Print Preview & Status & Navigation
    if (html) {
      setPrintHtml(html)
      setStatusMessage("")
      Promise.all(Array.from(document.images).filter(img => !img.complete).map(img => new Promise(resolve => { img.onload = img.onerror = resolve; }))).then(() => {
          bibleReferenceActions.goToBookChapterVerse(bibleReferenceState.bookId, bibleReferenceState.chapter, bibleReferenceState.verse)
      });
    }
  }, [html])

  return (
    <>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', position: "sticky", "top": "60px", background: "inherit", padding: "10px"}}>
        <BibleReference status={bibleReferenceState} actions={bibleReferenceActions}/>
      </div>
      {html && (
        <div style={{direction: catalogEntry ? catalogEntry.language_direction : "ltr"}}
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(html),
          }} />)}
    </>
  )
}

RcOpenBibleStories.propTypes = {
  urlInfo: PropTypes.object,
  catalogEntry: PropTypes.object,
  zipFileData: PropTypes.object,
  updateUrlHashLink: PropTypes.func,
  setStatusMessage: PropTypes.func,
  setErrorMessage: PropTypes.func,
  setCanChangeColumns: PropTypes.func,
  setPrintHtml: PropTypes.func,
}