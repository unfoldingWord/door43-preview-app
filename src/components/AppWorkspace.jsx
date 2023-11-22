import { useState, useContext } from 'react'
import Sheet from '@mui/joy/Sheet'
import Card from '@mui/joy/Card'
import Typography from '@mui/joy/Typography'
import { PrintModal, useUsfmPreviewRenderer } from '@oce-editor-tools/core'
import DOMPurify from 'dompurify'
import CircularProgressUI from '@mui/joy/CircularProgress'
import {getLtrPreviewStyle, getRtlPreviewStyle} from "../lib/previewStyling.js"
import { AppContext } from './App.context'
import Header from './Header'
import OpenModal from './OpenModal.jsx'
import { APP_NAME, BASE_DCS_URL } from '../common/constants'

export default function AppWorkspace() {
  const [isOpenPrint,setIsOpenPrint] = useState(false)
  const [isOpenModal,setIsOpenModal] = useState(false)

  const {
    state: {
      catalogEntry,
      errorMessage,
      loading, 
      usfmText, 
      usfmFileLoaded,
    },
  } = useContext(AppContext)

  const { 
    renderedData, 
    ready: htmlReady 
  } = useUsfmPreviewRenderer({ 
    usfmText, 
    renderStyles: catalogEntry ? (catalogEntry.language_direction === 'rtl' ? getRtlPreviewStyle() : getLtrPreviewStyle()) : getLtrPreviewStyle(),
    htmlRender: true
  })

  const usfmPreviewProps = {
    openPrintModal: isOpenPrint && usfmFileLoaded && htmlReady,
    handleClosePrintModal: () => {
      console.log('closePrintModal')
      setIsOpenPrint(false)
    },
    onRenderContent: () => renderedData,
    canChangeAtts: true,
    canChangeColumns: true,
  }

  const infoLine = catalogEntry 
    && (`${catalogEntry.owner}/${catalogEntry.name}/${catalogEntry.branch_or_tag_name}(${catalogEntry.ref_type})${(catalogEntry.ref_type !== "tag" ? "(" + catalogEntry.commit_sha.substring(0,10) + ")" : "")}/${catalogEntry.language_title}(${catalogEntry.language})/ `)
  
  return (
    <Sheet>
      <Header 
        title={APP_NAME}
        infoLine={infoLine}
        dcsRef={catalogEntry && `${BASE_DCS_URL}/${catalogEntry.owner}/${catalogEntry.repo.name}/src/${catalogEntry.ref_type}/${catalogEntry.branch_or_tag_name}`} 
        ready={usfmFileLoaded}
        onPrintClick={() => setIsOpenPrint(!isOpenPrint)}
        onOpenClick={() => setIsOpenModal(!isOpenModal)}
      />
      <Card sx={{marginTop: "70px"}}>
        {usfmFileLoaded && <PrintModal {...usfmPreviewProps} />}
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

