import { useState, useContext } from 'react'
import Sheet from '@mui/joy/Sheet'
import Card from '@mui/joy/Card'
import Typography from '@mui/joy/Typography'
import { useUsfmPreviewRenderer } from '@oce-editor-tools/base'
import { PrintDrawer } from '@oce-editor-tools/joy-core'
import DOMPurify from 'dompurify'
import CircularProgressUI from '@mui/joy/CircularProgress'
import {getLtrPreviewStyle, getRtlPreviewStyle} from "../lib/previewStyling.js"
// import markdown from '../lib/drawdown'
import { AppContext } from './App.context'
import Header from './Header'
import OpenModal from './OpenModal.jsx'
import { APP_NAME, BASE_DCS_URL } from '../common/constants'

export default function AppWorkspace() {
  const [isOpenPrint,setIsOpenPrint] = useState(false)
  const [isOpenModal,setIsOpenModal] = useState(false)
  // const [markdownHtmlStr, setMarkdownHtmlStr] = useState("")

  const {
    state: {
      catalogEntry,
      errorMessage,
      loading, 
      usfmText, 
      usfmFileLoaded,
    },
  } = useContext(AppContext)

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

  const { 
    renderedData,
    ready: htmlReady 
  } = useUsfmPreviewRenderer({ 
    usfmText, 
    renderFlags,
    renderStyles: catalogEntry ? (catalogEntry.language_direction === 'rtl' ? getRtlPreviewStyle() : getLtrPreviewStyle()) : getLtrPreviewStyle(),
    htmlRender: true
  })

  const usfmPreviewProps = {
    openPrintDrawer: isOpenPrint && usfmFileLoaded && htmlReady,
    handleClosePrintDrawer: () => {
      setIsOpenPrint(false)
    },
    onRenderContent: () => renderedData,
    canChangeAtts: false,
    canChangeColumns: true,
  }

  // const mdPreviewProps = {
  //   openPrintDrawer: isOpenPrint && mdFileLoaded && mdHtmlReady,
  //   handleClosePrintDrawer: () => {
  //     setIsOpenPrint(false)
  //   },
  //   onRenderContent: () => markdownHtmlStr,
  //   canChangeAtts: false,
  //   canChangeColumns: false,
  // }

  return (
    <Sheet>
      <Header 
        title={APP_NAME}
        // infoLine={infoLine}
        dcsRef={catalogEntry && `${BASE_DCS_URL}/${catalogEntry.owner}/${catalogEntry.repo.name}/src/${catalogEntry.ref_type}/${catalogEntry.branch_or_tag_name}`} 
        ready={usfmFileLoaded}
        onPrintClick={() => setIsOpenPrint(!isOpenPrint)}
        onOpenClick={() => setIsOpenModal(!isOpenModal)}
      />
      <Card sx={{marginTop: "70px"}}>
        {/* { mdFileLoaded && <PrintModal {...mdPreviewProps} />}
        { mdFileLoaded && (<div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(markdownHtmlStr)}}/>)} */}
        {usfmFileLoaded && <PrintDrawer {...usfmPreviewProps} />}
        {usfmFileLoaded &&
          (htmlReady ? (
            <>
              <div
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(renderedData),
                }}
              />
            </>
          ) : (
            <>
              <Typography color="textPrimary" gutterBottom display="inline">
                <>Converting from Usfm... </>
              </Typography>
              <CircularProgressUI />
            </>
          ))}
        {loading && (
          <>
            <Typography color="textPrimary" gutterBottom display="inline">
              <>Loading file from server... </>
            </Typography>
            <CircularProgressUI />
          </>
        )}
        {!usfmFileLoaded && <>{errorMessage}</>}
      </Card>
      <OpenModal 
        isOpenModal={isOpenModal}
        onCloseModal={()=>setIsOpenModal(false)}
      />
    </Sheet>
  )
}

