import { useState, useEffect } from 'react'

import IconButton from '@mui/joy/IconButton'
import Sheet from '@mui/joy/Sheet'
import Card from '@mui/joy/Card'
import Typography from '@mui/joy/Typography'
import PrintIcon from '@mui/icons-material/Print'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { PrintModal, useUsfmPreviewRenderer } from '@oce-editor-tools/core'
import DOMPurify from 'dompurify'
import markup from '../lib/drawdown'
import { decodeBase64ToUtf8 } from '../utils/base64Decode'
import { usfmFilename } from '../common/BooksOfTheBible'
import CircularProgressUI from '@mui/joy/CircularProgress'
import { fileOpen } from 'browser-fs-access'


export default function AppWorkspace() {
  const [isOpen,setIsOpen] = useState(false)
  const [markupHtmlStr, setMarkupHtmlStr] = useState("")
  const [mdFileLoaded, setMdFileLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState()
  const [usfmText, setUsfmText] = useState()
  const [usfmFileLoaded, setUsfmFileLoaded] = useState(false)
  const [resourceInfo, setResourceInfo] = useState(null);

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
  
    const info = {
      owner: "unfoldingWord",
      repo: "en_ult",
      ref: "master",
      refType: "branch",
      language: "en",
      textDirection: "ltr",
      resource: "",
      subject: "",
      title: "",
      commitID: "",
      bibleReference: {
        book: "tit",
        chapter: "1",
        verse: "1",
      }
    };

    const url = new URL(window.location.href)
    const urlParts = url.pathname.replace(/^\/u\//,"").split('/');
    if (urlParts[0])
      info.owner = urlParts[0]
    if (urlParts[1])
      info.repo = urlParts[1]
    if (urlParts[2])
      info.ref = urlParts[2]
    if (urlParts[3])
      info.bibleReference.book = urlParts[3].toLowerCase()
    if (urlParts[4])
      info.bibleReference.chapter = urlParts[4]
    if (urlParts[5])
      info.bibleReference.verse = urlParts[5]

    window.history.pushState({ id: "100" }, "Page", `/u/${info.owner}/${info.repo}/${info.ref}/${info.bibleReference.book}/${info.bibleReference.chapter!=="1"||info.bibleReference.verse!=="1"?`${info.bibleReference.chapter}/${info.bibleReference.verse}/`:""}`);
    
    setResourceInfo(info);
    const _filename = usfmFilename(info.bibleReference.book)
    const filePath = `https://git.door43.org/api/v1/repos/${info.owner}/${info.repo}/contents/${_filename}?ref=${info.ref}`
    handleInitialLoad(filePath)
  }, []);

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
        setMarkupHtmlStr(markup(contents))
        setUsfmFileLoaded(false)
        setMdFileLoaded(true)
      } else if (extStr === ".usfm") {
        const contents = await await file.text()
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
    onRenderContent: () => markupHtmlStr,
  }

  const { 
    renderedData, 
    ready: htmlReady 
  } = useUsfmPreviewRenderer({ 
    usfmText, 
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
          Door43 Preview
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
      <Card>
        { mdFileLoaded && <PrintModal {...mdPreviewProps} />}
        { mdFileLoaded && (<div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(markupHtmlStr)}}/>)}
        { usfmFileLoaded && <PrintModal {...usfmPreviewProps} />}
        { usfmFileLoaded && (htmlReady ? <div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(renderedData)}}/>: "Loading") }
        { loading && <CircularProgressUI/>}
        { !usfmFileLoaded && (
          <>
            {errorMessage}
            {JSON.stringify(resourceInfo)}
          </>
        )}
      </Card>
    </Sheet>
  )
}
