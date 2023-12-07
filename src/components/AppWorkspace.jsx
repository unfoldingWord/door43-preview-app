import { useState, useContext } from 'react'
import Sheet from '@mui/joy/Sheet'
import Card from '@mui/joy/Card'
import Typography from '@mui/joy/Typography'
import { PrintDrawer } from '@oce-editor-tools/joy-core'
import CircularProgressUI from '@mui/joy/CircularProgress'
import { AppContext } from './App.context'
import Header from './Header'
import OpenModal from './OpenModal.jsx'
import { APP_NAME, DCS_SERVERS } from '../common/constants'

export default function AppWorkspace() {
  const [isOpenPrint,setIsOpenPrint] = useState(false)
  const [isOpenModal,setIsOpenModal] = useState(false)

  const {
    state: {
      repo,
      catalogEntry,
      resourceComponent,
      errorMessage,
      printHtml,
      canChangeColumns,
      buildInfo,
      serverInfo,
    },
  } = useContext(AppContext)

  const printPreviewProps = {
    openPrintDrawer: isOpenPrint && printHtml,
    handleClosePrintDrawer: () => {
      setIsOpenPrint(false)
    },
    onRenderContent: () => `<div style="direction: ${catalogEntry?.language_direction}">${printHtml}</div>`,
    canChangeAtts: false,
    canChangeColumns,
  }

  let dcsRef = ""
  let infoLine = null
  if (repo && serverInfo?.baseUrl) {
    dcsRef = `${serverInfo?.baseUrl}/${repo?.owner.username}/${repo.name}`
    if (catalogEntry) {
      dcsRef += `/src/${catalogEntry.ref_type}/${catalogEntry.branch_or_tag_name}`
    }
    let infoLineText = repo.full_name
    if (catalogEntry) {
      if (catalogEntry.ref_type != 'tag') {
        infoLineText += `, ${catalogEntry.branch_or_tag_name} (${catalogEntry.commit_sha.substring(0,8)})`
      } else {
        infoLineText += `, ${catalogEntry.branch_or_tag_name}`
      }
    }
    if (serverInfo?.ID && serverInfo?.ID != DCS_SERVERS["prod"].ID) {
      infoLineText += ` (${serverInfo.ID})`
    }

    infoLine = (<a href={dcsRef} target={"_blank"} style={{textDecoration:"none", color: "inherit"}}>{infoLineText}</a>)
  }

  return (
    <Sheet>
      <Header
        title={APP_NAME}
        // infoLine={infoLine}
        dcsRef={dcsRef}
        infoLine={infoLine}
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

