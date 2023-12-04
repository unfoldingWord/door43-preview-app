import { useState, useContext } from 'react'
import Sheet from '@mui/joy/Sheet'
import Card from '@mui/joy/Card'
import Typography from '@mui/joy/Typography'
import { PrintDrawer } from '@oce-editor-tools/joy-core'
import CircularProgressUI from '@mui/joy/CircularProgress'
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
      repo,
      catalogEntry,
      resourceComponent,
      errorMessage,
      printHtml,
    },
  } = useContext(AppContext)

  const printPreviewProps = {
    openPrintDrawer: isOpenPrint && printHtml,
    handleClosePrintDrawer: () => {
      setIsOpenPrint(false)
    },
    onRenderContent: () => printHtml,
    canChangeAtts: false,
    canChangeColumns: true,
  }

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

  return (
    <Sheet>
      <Header 
        title={APP_NAME}
        // infoLine={infoLine}
        dcsRef={repo && `${BASE_DCS_URL}/${repo.owner.username}/${repo.name}` + (catalogEntry ? `/src/${catalogEntry.ref_type}/${catalogEntry.branch_or_tag_name}` : '')} 
        ready={printHtml != ""}
        onPrintClick={() => setIsOpenPrint(!isOpenPrint)}
        onOpenClick={() => setIsOpenModal(!isOpenModal)}
      />
      <Card sx={{marginTop: "70px"}}>
        {printHtml && <PrintDrawer {...printPreviewProps} />}
        {errorMessage ? <>{errorMessage}</> : resourceComponent ? resourceComponent :
          <>
            <Typography color="textPrimary" gutterBottom display="inline">
              <>Loading from server... </>
            </Typography>
            <CircularProgressUI />
          </>
        }
      </Card>
      <OpenModal 
        isOpenModal={isOpenModal}
        onCloseModal={()=>setIsOpenModal(false)}
      />
    </Sheet>
  )
}

