import { useState, useEffect, useContext } from "react";
import PropTypes from 'prop-types';
import Typography from "@mui/joy/Typography";
import DOMPurify from "dompurify";
import CircularProgressUI from "@mui/joy/CircularProgress";
import BibleReference, { useBibleReference } from 'bible-reference-rcl';
import { decodeBase64ToUtf8 } from "../utils/base64Decode";
import { API_PATH } from "../common/constants";
import markdown from '../lib/drawdown'
import { updateUrlHotlink } from "../utils/url";

export default function RcOpenBibleStories({
    urlInfo,
    serverInfo,
    catalogEntry,
    setErrorMessage,
    setPrintHtml,
    setCanChangeColumns,
}) {
  const [loading, setLoading] = useState(true)
  const [storiesMarkdown, setStoriesMarkdown] = useState()
  const [html, setHtml] = useState("")

  const onBibleReferenceChange = (b, c, v) => {
    const storyNum = parseInt(c)
    const frameNum = parseInt(v)    
    const story = document.getElementById(`story-${storyNum}`)
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
    let extraPath = [b]
    if (c != "1" || v != "1" || urlInfo.extraPath[1] || urlInfo.extraPath[2]) {
        extraPath = [b, c, v]
    }
    updateUrlHotlink({...urlInfo, extraPath})
  }
  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: "obs",
    initialChapter: urlInfo.extraPath[1] || "1",
    initialVerse: urlInfo.extraPath[2] || "1",
    onChange: onBibleReferenceChange,
    addOBS: true,
  })
  bibleReferenceActions.applyBooksFilter("obs")

  useEffect(() => {
    const downloadFile = async (url) => {
      try {
        const response = await fetch(url)
        if (!response.ok && response.status != 404) {
          const text = await response.text()
          throw Error(text)
        }
        if (response.status == 200) {
            const jsonResponse = await response.json()
            if (jsonResponse?.content) {
              return decodeBase64ToUtf8(jsonResponse.content)
            }
        } else {
             return ""
        }
      } catch (error) {
        setErrorMessage(error?.message)
        setLoading(false)
      }
    }

    const loadMarkdownFiles = async () => {
      let markdownFiles = []

      for (let i = 1; i < 51; ++i) {
        const filePath = "content/" + `${i}`.padStart(2, '0') + ".md"
        const fileURL = `${serverInfo.baseUrl}/${API_PATH}/repos/${catalogEntry.owner}/${catalogEntry.repo.name}/contents/${filePath}?ref=${catalogEntry.commit_sha}`
        const markdownFile = await downloadFile(fileURL)
        markdownFiles.push(markdownFile ? markdownFile : `# ${i}. STORY NOT FOUND!\n\n`)
      }
      setStoriesMarkdown(markdownFiles)
      setLoading(false)
    }

    if (catalogEntry && serverInfo?.baseUrl) {
      loadMarkdownFiles()
    }
  }, [catalogEntry, setErrorMessage, serverInfo?.baseUrl])

  useEffect(() => {
    if (! html && storiesMarkdown) {
        let _html = `<h1 style="text-align: center">${catalogEntry.title}</h1>\n`
        storiesMarkdown.forEach((storyMarkdown, i) => {
            _html += `<div id="story-${i+1}">${markdown(storyMarkdown)}</div>`
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
      {html ? (
        <>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', position: "sticky", "top": "60px", background: "inherit", padding: "10px"}}>
            <BibleReference status={bibleReferenceState} actions={bibleReferenceActions}/>
          </div>
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
  serverInfo: PropTypes.object,
  catalogEntry: PropTypes.object,
  setErrorMessage: PropTypes.func,
  setPrintHtml: PropTypes.func,
}