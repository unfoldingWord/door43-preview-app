import { useState, useContext } from 'react'

import IconButton from '@mui/joy/IconButton'
import Sheet from '@mui/joy/Sheet'
import Card from '@mui/joy/Card'
import CardContent from "@mui/joy/CardContent";
import Typography from '@mui/joy/Typography'
import PrintIcon from '@mui/icons-material/Print'
import { PrintModal, useUsfmPreviewRenderer } from '@oce-editor-tools/core'
import DOMPurify from 'dompurify'
import CircularProgressUI from '@mui/joy/CircularProgress'
import {getLtrPreviewStyle, getRtlPreviewStyle} from "../lib/previewStyling.js"
import { AppContext } from './App.context'
import ReactWindowNavigator from './ReactWindowNavigator'
import Navigator from './Navigator'
import { APP_NAME, BASE_DCS_URL } from '../common/constants'

export default function AppWorkspace() {
  const [isOpen,setIsOpen] = useState(false)

  const {
    state: {
      catalogEntry,
      languages,
      organizations,
      errorMessage,
      loading, 
      usfmText, 
      usfmFileLoaded,
    },
  } = useContext(AppContext)

  const langOptions = languages?.map(x => {
    const ln = x?.ln
    const ang = x?.ang
    const doUseAng = x?.ang && (ln !== ang)
    const label = doUseAng ? `${x?.ln} (${x.ang})` : x?.ln
    return {
      label, 
      value: x?.lc
    }
  }) || []
  
  const orgOptions = organizations?.map(x => ({label: x, value: x}))

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

  const enabledPrintPreview = usfmFileLoaded

  const handlePrintPreviewClick = () => setIsOpen(!isOpen)
 
  return (
    <Sheet>
      <Sheet
        variant="outlined"
        sx={{ borderRadius: "md", display: "flex", gap: 2, p: 0.5 }}
      >
        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{ flexGrow: 1, ml: 2, display: { xs: "none", sm: "block" } }}
        >
          <b>{APP_NAME}</b>
        </Typography>
        <IconButton
          size="large"
          edge="start"
          color="inherit"
          onClick={handlePrintPreviewClick}
          disabled={!enabledPrintPreview}
          aria-label="print preview"
          sx={{ mr: 2 }}
        >
          <PrintIcon />
        </IconButton>
      </Sheet>

      {catalogEntry ? (
        <Card variant="outlined">
          <CardContent>
            <Typography color="textPrimary" gutterBottom display="inline">
              <>
              {orgOptions && catalogEntry?.owner && (<Navigator
                  onInputChange={(event, newInputValue) => {
                    console.log(event,newInputValue)
                  }}
                  defaultValue={{label: catalogEntry?.owner, value: catalogEntry?.owner}}
                  options={orgOptions}
                />)}
                <b>
                  /{catalogEntry.name}
                </b>{" "}
                / {catalogEntry.branch_or_tag_name} ({catalogEntry.ref_type})
                {catalogEntry.ref_type !== "tag"
                  ? " (" + catalogEntry.commit_sha.substring(0, 10) + ")"
                  : ""}{" "}
                {langOptions && (<ReactWindowNavigator 
                  options={langOptions} 
                  defaultValue={{label: catalogEntry?.language_title, value: "en" }}
                  onInputChange={(event, newInputValue) => console.log(event, newInputValue)}
                />)}
                /{" "}
                <a
                  href={`${BASE_DCS_URL}/${catalogEntry.owner}/${catalogEntry.repo.name}/src/${catalogEntry.ref_type}/${catalogEntry.branch_or_tag_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "12px" }}
                >
                  {"See on DCS"}
                </a>
              </>
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <></>
      )}

      <Card>
        {/* { mdFileLoaded && <PrintModal {...mdPreviewProps} />}
        { mdFileLoaded && (<div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(html)}}/>)} */}
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
    </Sheet>
  );
}

