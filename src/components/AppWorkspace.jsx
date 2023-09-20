import { useState, useEffect } from 'react'
import { useTheme } from '@mui/material/styles'
import { PrintModal, useUsfmPreviewRenderer } from '@oce-editor-tools/core'
import DOMPurify from 'dompurify'
import markup from '../lib/drawdown'
import { decodeBase64ToUtf8 } from '../utils/base64Decode'
import { usfmFilename } from '../common/BooksOfTheBible'
import CircularProgress from './CircularProgress'
import { fileOpen } from 'browser-fs-access'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import PrintIcon from '@mui/icons-material/Print'
import Paper from '@mui/material/Paper'
import { ThemeProvider } from '@mui/material/styles'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'

export default function AppWorkspace() {
  const theme = useTheme()
  const [markupHtmlStr, setMarkupHtmlStr] = useState("")
  const [isOpen,setIsOpen] = useState(false)
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
        console.log(jsonResponse)
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
      supportedBooks: [],
      bibleReference: {
        book: "tit",
        chapter: "1",
        verse: "1",
      }
    };

    const urlParts = new URL(window.location.href).pathname.split('/').slice(1);
    if (urlParts[0])
      info.owner = urlParts[0] || info.owner
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
    
    setResourceInfo(info);
    const _filename = usfmFilename(info.bibleReference.book)
    const filePath = `https://git.door43.org/api/v1/repos/${info.repo}/${info.ref}/contents/${_filename}`
    console.log(filePath)
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

  const appBarAndWorkSpace = 
    <div style={{paddingTop: '100px'}}>
        { mdFileLoaded && <PrintModal {...mdPreviewProps} />}
        { mdFileLoaded && (<div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(markupHtmlStr)}}/>)}
        { usfmFileLoaded && <PrintModal {...usfmPreviewProps} />}
        { usfmFileLoaded && (htmlReady ? <div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(renderedData)}}/>: "Loading") }
        { loading && <CircularProgress size={180} />}
        { !usfmFileLoaded && (
          <>
            {errorMessage}
            {JSON.stringify(resourceInfo)}
          </>
        )}
    </div>

  const enabledPrintPreview = (usfmFileLoaded || mdFileLoaded)

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Paper sx={{ position: 'fixed', top: 0, left: 0, right: 0 }} elevation={3}>
        <AppBar position="static">
          <Toolbar>
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }}
            >
              Door43 Preview
            </Typography>
            <ThemeProvider theme={theme}>
              <IconButton
                size="large"
                edge="start"
                color="inherit"
                onClick={handleOpen}
                aria-label="print preview"
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
            </ThemeProvider>
          </Toolbar>
        </AppBar>
      </Paper>
      {appBarAndWorkSpace}
    </Box>
  )
}
