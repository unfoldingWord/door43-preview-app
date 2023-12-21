import { useState, useContext } from 'react'
import Sheet from '@mui/joy/Sheet'
import Card from '@mui/joy/Card'
import Typography from '@mui/joy/Typography'
import { PrintDrawer } from '@oce-editor-tools/joy-core'
import CircularProgressUI from '@mui/joy/CircularProgress'
import { AppContext } from './App.context'
import Header from './Header'
import OpenModal from './OpenModal.jsx'
import { APP_NAME, DCS_SERVERS } from '../common/constants.js'

export default function AppWorkspace() {
  const [isOpenPrint,setIsOpenPrint] = useState(false)
  const [isOpenModal,setIsOpenModal] = useState(false)

  const {
    state: {
      repo,
      urlInfo,
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
  if (urlInfo && serverInfo?.baseUrl) {
    let repoFullName = `${urlInfo.owner}/${urlInfo.repo}`
    if(repo) {
      repoFullName = repo.full_name
    }
    dcsRef = `${serverInfo?.baseUrl}/${repoFullName}`
    if (catalogEntry) {
      dcsRef += `/src/${catalogEntry.ref_type}/${catalogEntry.branch_or_tag_name}`
    } else {
      dcsRef += `/src/branch/${urlInfo.ref || repo?.default_branch || "master"}`
    }
    let infoLineText = repoFullName
    if (catalogEntry?.branch_or_tag_name) {
      if (catalogEntry.ref_type == 'branch') {
        infoLineText += `, ${catalogEntry.branch_or_tag_name} (${catalogEntry.commit_sha?.substring(0,8)})`
      } else {
        infoLineText += `, ${catalogEntry.branch_or_tag_name}`
      }
    }

    infoLine = (<a href={dcsRef} target={"_blank"} style={{textDecoration:"none", color: "inherit"}}>{infoLineText}</a>)
  }

  let title = APP_NAME
  if (serverInfo?.ID && serverInfo?.ID != DCS_SERVERS["prod"].ID) {
    title += ` (${serverInfo.ID})`
  }

  return (
    <Sheet>
      <Header
        title={title}
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

