import { useState, useEffect, useContext } from "react";
import PropTypes from 'prop-types';
import Typography from "@mui/joy/Typography";
import DOMPurify from "dompurify";
import CircularProgressUI from "@mui/joy/CircularProgress";
import BibleReference, { useBibleReference } from 'bible-reference-rcl';
import { decodeBase64ToUtf8 } from "../utils/base64Decode";
import { API_PATH } from "../common/constants";
import markdown from '../lib/drawdown'
import { updateUrlHashLink } from "../utils/url";
import * as JSZip from "jszip";

export default function RcOpenBibleStories({
    urlInfo,
    catalogEntry,
    setErrorMessage,
    setPrintHtml,
    setCanChangeColumns,
}) {
  const [loading, setLoading] = useState(true)
  const [zipFileData, setZipFileData] = useState()
  const [storiesMarkdown, setStoriesMarkdown] = useState()
  const [html, setHtml] = useState("")

  const onBibleReferenceChange = (b, c, v) => {
    const storyNum = parseInt(c)
    const frameNum = parseInt(v)    
    const story = document.getElementById(`obs-${storyNum}-1`)
    if ((storyNum == 1 && frameNum == 1) || ! story) {
        window.scrollTo({top: 0, behavior: "smooth"})
    } else if (story) {
        let frame = story
        if (frameNum > 1 && story.children[frameNum*2]) {
            frame = story.children[frameNum*2] // There are 2 elements for every frame: image and text, and two title elements
        }
        if (frame) {
            window.scrollTo({top: frame.getBoundingClientRect().top + window.scrollY - 130, behavior: "smooth"})
        }
    }
    let hashParts = [b]
    if (c != "1" || v != "1" || urlInfo.hashParts[1] || urlInfo.hashParts[2]) {
        hashParts = [b, c, v]
    }
    updateUrlHashLink({...urlInfo, hashParts})
  }
  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: "obs",
    initialChapter: urlInfo.hashParts[1] || "1",
    initialVerse: urlInfo.hashParts[2] || "1",
    onChange: onBibleReferenceChange,
    addOBS: true,
  })
  bibleReferenceActions.applyBooksFilter("obs")

  useEffect(() => {
    const loadZipFile = async () => {
      try {
        console.log("Downloading ", catalogEntry.zipball_url)
        fetch(catalogEntry.zipball_url)
        .then(response => response.arrayBuffer())
        .then(data => setZipFileData(data))
      } catch (error) {
        setErrorMessage(error?.message)
        setLoading(false)
      }
    }

    if (catalogEntry && !zipFileData) {
        loadZipFile()
    }
  }, [catalogEntry, zipFileData])

  useEffect(() => {
    const loadMarkdownFiles = async () => {
      let markdownFilesHash = {}
      const zip = await JSZip.loadAsync(zipFileData)
      let markdownFiles = []
      console.log(Object.keys(zip.files))
      for (let i = 1; i < 51; ++i) {
        const filename = `${catalogEntry.repo.name}/content/${`${i}`.padStart(2, '0')}.md`
        console.log(filename)
        if (filename in zip.files) {
            markdownFiles.push(await zip.file(filename).async('text'))
        } else {
            markdownFiles.push(`# ${i}. STORY NOT FOUND!\n\n`)
        }
      }
      setStoriesMarkdown(markdownFiles)
      setLoading(false)
    }

    if (catalogEntry && zipFileData) {
      loadMarkdownFiles()
    }
  }, [catalogEntry, zipFileData])

  useEffect(() => {
    if (! html && storiesMarkdown) {
        let _html = `<h1 style="text-align: center">${catalogEntry.title}</h1>\n`
        storiesMarkdown.forEach((storyMarkdown, i) => {
            _html += `<div id="obs-${i+1}-1">${markdown(storyMarkdown)}</div>`
        })
        setHtml(_html)
        setPrintHtml(_html)
    }
  }, [storiesMarkdown, html])


  useEffect(() => {
    if (html) {
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
      {html ? (
        <>
          <div style={{direction: catalogEntry ? catalogEntry.language_direction : "ltr"}}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(html),
            }}
          />
        </>
      ) : loading ? (
        <>
          <Typography color="textPrimary" gutterBottom display="inline">
            <>Loading files from server... </>
          </Typography>
          <CircularProgressUI />
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

RcOpenBibleStories.propTypes = {
  catalogEntry: PropTypes.object,
  setErrorMessage: PropTypes.func,
  setPrintHtml: PropTypes.func,
}