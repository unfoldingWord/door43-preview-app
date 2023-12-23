import { useState, useContext } from 'react';
import { Typography, Modal } from '@mui/material';
import { Sheet, Card, Box, Alert, CircularProgress } from '@mui/joy';
import { PrintDrawer } from '@oce-editor-tools/joy-core';
import { AppContext } from './App.context';
import Header from './Header';
import OpenModal from './OpenModal.jsx';
import { APP_NAME, DCS_SERVERS } from '../common/constants.js';

export default function AppWorkspace() {
  const [isOpenPrint,setIsOpenPrint] = useState(false)
  const [isOpenModal,setIsOpenModal] = useState(false)

  const {
    state: {
      repo,
      urlInfo,
      catalogEntry,
      resourceComponent,
      statusMessage,
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

  const processModalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'white',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
    backdropFilter: "none",
  };

  return (
    <Sheet>
      {(window.location.hostname == "preview.door43.org" || window.location.hostname.includes("netlify") || window.location.host == "localhost:5173" || window.Location.port == "localhost:4173") && 
      <Header
        title={title}
        dcsRef={dcsRef}
        infoLine={infoLine}
        ready={printHtml != ""}
        onPrintClick={() => setIsOpenPrint(!isOpenPrint)}
        onOpenClick={() => setIsOpenModal(!isOpenModal)}
      />}
      <Card sx={{marginTop: "70px"}}>
        {printHtml && <PrintDrawer {...printPreviewProps} />}
        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        {resourceComponent}
        {statusMessage && !printHtml && !errorMessage &&
        <Modal
          open={true}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={processModalStyle}>
            <Typography id="modal-modal-title" variant="h6" component="h2" sx={{textAlign: "center"}}>
              <CircularProgress />
            </Typography>
            <Typography id="modal-modal-description" sx={{ mt: 2, textAlign: "center" }}>
              {statusMessage}
            </Typography>
          </Box>
        </Modal>}
      </Card>
      <OpenModal
        isOpenModal={isOpenModal}
        onCloseModal={()=>setIsOpenModal(false)}
      />
    </Sheet>
  )
}

