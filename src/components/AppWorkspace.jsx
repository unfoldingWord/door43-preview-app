/* eslint-disable no-unused-vars */
import { useState, useEffect, useContext } from 'react'

import IconButton from '@mui/joy/IconButton'
import Sheet from '@mui/joy/Sheet'
import Card from '@mui/joy/Card'
import CardContent from "@mui/joy/CardContent";
import Typography from '@mui/joy/Typography'
import PrintIcon from '@mui/icons-material/Print'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { PrintModal, useUsfmPreviewRenderer } from '@oce-editor-tools/core'
import DOMPurify from 'dompurify'
import markup from '../lib/drawdown'
import { decodeBase64ToUtf8 } from '../utils/base64Decode'
import CircularProgressUI from '@mui/joy/CircularProgress'
import { fileOpen } from 'browser-fs-access'
import {getLtrPreviewStyle, getRtlPreviewStyle} from "../lib/previewStyling.js";
import { AppContext } from './App.context';
import { API_PATH, APP_NAME, BASE_DCS_URL } from '../common/constants';
import BibleReference, { useBibleReference } from 'bible-reference-rcl';


export default function AppWorkspace() {
  const [isOpen,setIsOpen] = useState(false)
  const [mdFileLoaded, setMdFileLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [usfmText, setUsfmText] = useState()
  const [usfmFileLoaded, setUsfmFileLoaded] = useState(false)

  // app context
  const {
    state: {
      urlInfo,
      catalogEntry,
      bibleReference,
      html,
      errorMessage,
    },
    actions: {
      setBibleReference,
      setHtml,
      setErrorMessage,
    },
  } = useContext(AppContext)

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: bibleReference.book,
    initialChapter: bibleReference.chapter,
    initialVerse: bibleReference.verse,
    onChange: (book, chapter, verse) => {
      console.log("CHANGE: ", book, chapter, verse)
      if (book != bibleReference.book) {
        window.location.href = `/u/${urlInfo.owner}/${urlInfo.repo}/${urlInfo.ref}/${book}`
      } else {
        document.getElementById(`chapter-${chapter}-verse-${verse}`).scrollIntoView();        
      }
    }
  });

  useEffect(() => {
    const handleInitialLoad = async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          const text = await response.text();
          throw Error(text);
        }
        
        const jsonResponse = await response.json();
        if (jsonResponse?.content) {
          const _usfmText = decodeBase64ToUtf8(jsonResponse.content)
          setUsfmText(_usfmText)
          setUsfmFileLoaded(true)
          setMdFileLoaded(false)
        }
        setLoading(false)
          
      } catch (error) {
        console.log(error);
        setErrorMessage(error?.message)
        setLoading(false)
      }      
    }

    const loadFile = async () => {
      let filePath = null
      for(let i = 0; i < catalogEntry.ingredients.length; ++i) {
        const ingredient = catalogEntry.ingredients[i]
        console.log("HERE: "+bibleReference.book)
        if (ingredient.identifier == bibleReference.book) {
          filePath = ingredient.path
          break
        }
      }
      if (! filePath) {
        setErrorMessage("Book not supported")
        setLoading(false)
      } else {
        const fileURL = `${BASE_DCS_URL}/${API_PATH}/repos/${catalogEntry.owner}/${catalogEntry.repo.name}/contents/${filePath}?ref=${catalogEntry.commit_sha}`
        console.log(fileURL)
        handleInitialLoad(fileURL)
      }
    }

    console.log("catalogEntry2", catalogEntry, "bibleReference2", bibleReference)
    if (catalogEntry && bibleReference) {
      loadFile()
    }
  }, [catalogEntry, bibleReference]);

  const handleOpen = async () => {
    const file = await fileOpen([
      {
        description: 'USFM and Markup - text files',
        mimeTypes: ['text/*'],
        extensions: ['.md','.usfm'],
      }
    ])
    const filePath = file?.name
    if (filePath !== null) {
      const extStr = filePath?.substring(filePath?.lastIndexOf("."))
      if (extStr === ".md") {
        const contents = await file.text()
        setHtml(markup(contents))
        setUsfmFileLoaded(false)
        setMdFileLoaded(true)
      } else if (extStr === ".usfm") {
        const contents = await file.text()
        setUsfmText(contents)
        setUsfmFileLoaded(true)
        setMdFileLoaded(false)
      } else {
        console.log("invalid file extension")
      }
    } else {
      console.log("invalid file")
    }
  }

  const handlePrintPreviewClick = () => setIsOpen(!isOpen)

  const mdPreviewProps = {
    openPrintModal: isOpen && mdFileLoaded,
    handleClosePrintModal: () => {
      console.log('closePrintModal')
      setIsOpen(false)
    },
    onRenderContent: () => html,
  }

  const { 
    renderedData, 
    ready: htmlReady 
  } = useUsfmPreviewRenderer({ 
    usfmText, 
    renderStyles: catalogEntry ? (catalogEntry.language_direction === 'rtl' ? getRtlPreviewStyle() : getLtrPreviewStyle()) : getLtrPreviewStyle(),
    htmlRender: true
  })

  const usfmPreviewProps = {
    openPrintModal: isOpen && usfmFileLoaded && htmlReady,
    handleClosePrintModal: () => {
      console.log('closePrintModal')
      setIsOpen(false)
    },
    onRenderContent: () => renderedData,
    canChangeAtts: true,
    canChangeColumns: true,
  }

  const enabledPrintPreview = (usfmFileLoaded || mdFileLoaded)

  return (
    <Sheet>
      <Sheet
        variant="outlined"
        sx={{ borderRadius: 'md', display: 'flex', gap: 2, p: 0.5 }}
      >
        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{ flexGrow: 1, ml: 2, display: { xs: 'none', sm: 'block' } }}
        >
          <b>{APP_NAME}</b>
        </Typography>

        <IconButton
            size="large"
            edge="start"
            color="inherit"
            onClick={handleOpen}
            aria-label="folder open"
            sx={{ mr: 2 }}
          >
          <FolderOpenIcon/>
        </IconButton>
        <IconButton
            size="large"
            edge="start"
            color="inherit"
            onClick={handlePrintPreviewClick}
            disabled={!enabledPrintPreview}
            aria-label="print preview"
            sx={{ mr: 2 }}
          >
          <PrintIcon/>
        </IconButton>
      </Sheet>

      {catalogEntry ?
      <Card variant="outlined">
        <CardContent>
          <Typography
            color="textPrimary"
            gutterBottom
            display="inline"
          >
              <><b>{catalogEntry.owner}/{catalogEntry.name}</b> / {catalogEntry.branch_or_tag_name} ({catalogEntry.ref_type}){(catalogEntry.ref_type !== "tag" ? " (" + catalogEntry.commit_sha.substring(0,10) + ")" : "")} / {catalogEntry.language_title} ({catalogEntry.language}) / <a href={`https://qa.door43.org/${catalogEntry.owner}/${catalogEntry.repo.name}/src/${catalogEntry.ref_type}/${catalogEntry.branch_or_tag_name}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px" }}>{"See on DCS"}</a></>
          </Typography>
        </CardContent>
      </Card>
      : <></>}

      <Card>
        { mdFileLoaded && <PrintModal {...mdPreviewProps} />}
        { mdFileLoaded && (<div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(html)}}/>)}
        { usfmFileLoaded && <PrintModal {...usfmPreviewProps} />}
        { usfmFileLoaded && (htmlReady ? 
          (<>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                // justifyContent: "center"
              }}
            >
              <BibleReference status={bibleReferenceState} actions={bibleReferenceActions} />
            </div>
            <div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(renderedData)}}/>
          </>): "Loading...") }
        { loading && <CircularProgressUI/>}
        { !usfmFileLoaded && (
          <>
            {errorMessage}
          </>
        )}
      </Card>
    </Sheet>
  )
}
