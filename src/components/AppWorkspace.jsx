import { useState, useEffect, useContext, useRef } from "react";
import {
  Typography,
  AppBar,
  Toolbar,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  Sheet,
  Card,
  Box,
  Alert,
  CircularProgress,
  IconButton,
} from "@mui/joy";
import { Tooltip } from "@mui/joy";
import PrintIcon from "@mui/icons-material/Print";
import WebIcon from "@mui/icons-material/Web";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ReportIcon from "@mui/icons-material/Report";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PrintDrawer from "./PrintDrawer";
import { AppContext } from "./App.context";
import Header from "./Header";
import SelectResourceToPreviewModal from "./SelectResourceToPreviewModal";
import { APP_NAME, DCS_SERVERS } from "@common/constants";
import { useReactToPrint } from "react-to-print";
import { updateUrlHashInAddressBar } from "@utils/url";
import { ResourcesCardGrid } from "./ResourcesCardGrid"
import { ResourceLanguagesAccordion } from "./ResourceLanguagesAccordion";
import { WebPreviewComponent } from "./WebPreviewComponent";
import { PrintPreviewComponent } from "./PrintPreviewComponent";
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import { element } from "prop-types";


export default function AppWorkspace() {
  const [initialized, setInitialized] = useState(false)
  const [showSelectResourceModal, setShowSelectResourceModal] = useState(false)
  const [view, setView] = useState("web")
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [printPreviewState, setPrintPreviewState] = useState("not started")

  const {
    state: {
      repo,
      urlInfo,
      catalogEntry,
      ResourceComponent,
      statusMessage,
      errorMessages,
      htmlSections,
      webCss,
      printCss,
      canChangeColumns,
      serverInfo,
      isOpenPrint,
      printOptions,
      documentAnchor,
    },
    actions: {
      clearErrorMessage,
      setHtmlSections,
      setIsOpenPrint,
      setPrintOptions,
      setDocumentAnchor,
      setDocumentReady,
    },
  } = useContext(AppContext)

  const webPreviewRef = useRef()
  const printPreviewRef = useRef()

  const currentViewRef = useRef(webPreviewRef)
  
  const printReactComponent = useReactToPrint({
    documentTitle: `${catalogEntry?.owner}--${catalogEntry?.repo.name}--${catalogEntry?.branch_or_tag_name}`,
    content: () => printPreviewRef.current,
  })
  const handlePrint = () => {
    if(printPreviewState != "rendered") {
      alert("The document is not yet ready to print. Please wait...")
      return false
    }
    printReactComponent()
  }

  // const handlePrint = () => {
  //   if (! html) {
  //     setErrorMessage("Nothing to print")
  //   }
  //   const newPage = window.open()
  //   newPage.document.body.innerHTML = html
  //   newPage.document.body.setAttribute('onLoad',"window.print()")
  //   newPage.document.head.innerHTML = '<title>PDF Preview</title>'
  //   const styleElement = document.createElement('style')
  //   styleElement.innerHTML = styles + `#paras { columns: ${printOptions.columns}; }`
  //   newPage.document.head.appendChild(styleElement)
  // }

  const printDrawerProps = {
    openPrintDrawer: isOpenPrint && htmlSections?.body != "",
    onClosePrintDrawer: () => {
      setIsOpenPrint(false)
    },
    canPrint: printPreviewState == "rendered",
    canChangeAtts: false,
    canChangeColumns,
    printOptions,
    setPrintOptions,
    handlePrint,
  }

  const onUpArrowClick = () => {
    window.scrollTo({top: 0})
  }
  
  let dcsRef = ""
  let infoLine = null
  if (urlInfo && serverInfo?.baseUrl) {
    let repoFullName = `${urlInfo.owner}/${urlInfo.repo}`
    if (repo) {
      repoFullName = repo.full_name
    }
    dcsRef = `${serverInfo?.baseUrl}/${repoFullName}`
    if (catalogEntry) {
      dcsRef += `/src/${catalogEntry.ref_type}/${catalogEntry.branch_or_tag_name}`
    } else {
      dcsRef += `/src/branch/${
        urlInfo.ref || repo?.default_branch || "master"
      }`
    }
    let infoLineText = repoFullName
    if (catalogEntry?.branch_or_tag_name) {
      if (catalogEntry.ref_type == "branch") {
        infoLineText += `, ${
          catalogEntry.branch_or_tag_name
        } (${catalogEntry.commit_sha?.substring(0, 8)})`
      } else {
        infoLineText += `, ${catalogEntry.branch_or_tag_name}`
      }
    }

    infoLine = (
      <a
        href={dcsRef}
        target={"_blank"}
        style={{ textDecoration: "none", color: "inherit" }}
        rel="noreferrer"
      >
        {infoLineText}
      </a>
    )
  }

  let title = APP_NAME
  if (serverInfo?.ID && serverInfo?.ID != DCS_SERVERS["prod"].ID) {
    title += ` (${serverInfo.ID})`
  }

  const processModalStyle = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 400,
    bgcolor: "white",
    border: "2px solid #000",
    boxShadow: 24,
    p: 4,
    backdropFilter: "none",
  }

  const scrollToAnchor = async (anchor, ref) => {
    if (anchor && ref && ref.current && ref.current.innerHTML) {
      let elementToScrollTo = ref.current.querySelector(`[id='${anchor}']`)
      if (elementToScrollTo) {
        window.scrollTo({
          top: elementToScrollTo.getBoundingClientRect().top + window.scrollY - document.querySelector("header").offsetHeight - 5,
        })
        return true
      }
    }
  }

  useEffect(() => {
    currentViewRef.current = view == "web" ? webPreviewRef : printPreviewRef
  }, [view]);

  useEffect(() => {
    const handleClick = (e) => {
      const a = e.target.closest("a")
      if (! a) {
        return
      }
      let href = a.getAttribute('href')
      if (href && href.startsWith('#')) {
        href = href.replace(/^#/, '')
        if (! href.startsWith('note-')) {
          console.log("SET DOCUMENT ANCHOR", href)
          setDocumentAnchor(href)
        } else {
          console.log("Scrolling without setting to: ", href)
          scrollToAnchor(href, currentViewRef.current)
        }
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.querySelector('#root').addEventListener('click', handleClick)
    return () => {
      document.querySelector('#root').removeEventListener('click', handleClick);
    }
  }, [setDocumentAnchor])

  useEffect(() => {
    if (documentAnchor) {
      updateUrlHashInAddressBar(documentAnchor)
    }
  }, [documentAnchor])

  useEffect(() => {
    const determineIfImagesLoaded = async () => {
      Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise((resolve) => {
                img.onload = img.onerror = resolve
              })
          )
      ).then(() => {
        console.log("IMAGES DONE. DOC READY.")
        setImagesLoaded(true)
      })
    }

    setImagesLoaded(false)
    if (htmlSections?.body) {
      determineIfImagesLoaded()
    } else {
      console.log("HTML IS EMPTY. DOC NOT READY.")
    }
  }, [htmlSections?.body, view])

  useEffect(() => {
    setDocumentReady(
      (view == "web" && imagesLoaded) ||
        (view == "print" && printPreviewState == "rendered")
    )
  }, [imagesLoaded, printPreviewState])

  useEffect(() => {
    if (htmlSections?.body && documentAnchor && ((view == "web" && webPreviewRef.current.innerHTML) || (view == "print" && printPreviewRef.current.innerHTML))) {
      console.log("SCROLLING TO DOCUMENT ANCHOR: ", documentAnchor)
      scrollToAnchor(documentAnchor, currentViewRef.current)
    }
  }, [view, htmlSections?.body, documentAnchor, webPreviewRef?.current?.innerHTML, printPreviewRef?.current?.innerHTML])

  return (
    <Sheet>
      {(window.location.hostname == "preview.door43.org" ||
        window.location.hostname.includes("netlify") ||
        window.location.host == "localhost:5173" ||
        window.location.host == "localhost:4173") && (
        <Header
          title={title}
          dcsRef={dcsRef}
          infoLine={infoLine}
          onOpenClick={() =>
            setShowSelectResourceModal(!showSelectResourceModal)
          }
        />
      )}
      <Card>
        {htmlSections?.body && <PrintDrawer {...printDrawerProps} />}
        {urlInfo && <AppBar
          position="relative"
          sx={{ backgroundColor: "white", position: "sticky", top: "0", color: "black" }}
        >
          <Toolbar
            sx={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              height: "10px",
              overflowX: "scroll",
              paddingTop: "10px",
              paddingBottom: "10px",
            }}
          >
            <div>&nbsp;</div>
            {ResourceComponent ? <ResourceComponent /> : ""}
            <div style={{ whiteSpace: "nowrap" }}>
              <ToggleButtonGroup
                value={view}
                exclusive
                onChange={(e, value) => {
                  if (value !== null) {
                    setView(value)
                  }
                }}
                aria-label="View"
                disabled={!htmlSections?.body}
              >
                <ToggleButton value="web" aria-label="Web view">
                  <Tooltip title="Web view" arrow>
                    <WebIcon />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton
                  value="print"
                  aria-label="Print view"
                  disabled={!htmlSections?.body}
                >
                  <Tooltip title="Print view" arrow>
                    <MenuBookIcon />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
              <Tooltip title="Print" arrow>
                <IconButton disabled={!htmlSections.body}>
                  <PrintIcon
                    onClick={() => {
                      setView("print")
                      setIsOpenPrint(true)
                    }}
                  />
                </IconButton>
              </Tooltip>
              <Tooltip title="Back to top" arrow>
                <IconButton onClick={onUpArrowClick} disabled={window.scrollY==0}>
                  <KeyboardDoubleArrowUpIcon />
                </IconButton>     
              </Tooltip>       
            </div>
          </Toolbar>
        </AppBar>}
        {errorMessages.map((message, i) => (
          <Alert
            key={`errorMessage${i}`}
            sx={{ alignItems: "flex-start" }}
            startDecorator={<ReportIcon />}
            variant="soft"
            color="danger"
            endDecorator={
              <IconButton
                variant="soft"
                color="danger"
                onClick={() => clearErrorMessage(i)}
              >
                <CloseRoundedIcon />
              </IconButton>
            }
          >
            <div>
              <div>Error</div>
              <Typography level="body-sm" color="danger">
                {message}
              </Typography>
            </div>
          </Alert>
        ))}
        {urlInfo && urlInfo.owner == "downloadables" && serverInfo && 
          <ResourceLanguagesAccordion serverInfo={serverInfo} subjects={["Open Bible Stories", "OBS Study Notes", "OBS Study Questions", "OBS Translation Notes", "OBS Translation Questions", "TSV OBS Study Notes", "TSV OBS Study Questions", "TSV OBS Translation Notes", "TSV OBS Translation Questions"]} />}
        {urlInfo && !urlInfo.owner && serverInfo && 
          <ResourcesCardGrid serverInfo={serverInfo} />}
        {urlInfo && urlInfo.owner && urlInfo.repo && serverInfo && view == "web" &&
        <WebPreviewComponent
          html={htmlSections.body}
          webCss={webCss + printCss}
          ref={webPreviewRef}
          style={{
            display: view == "web" ? "block" : "none",
            direction: catalogEntry ? catalogEntry.language_direction : "ltr",
          }}
        />}
        {urlInfo && urlInfo.owner && urlInfo.repo && serverInfo &&
        <PrintPreviewComponent
          catalogEntry={catalogEntry}
          htmlSections={htmlSections}
          webCss={webCss}
          printCss={printCss}
          printOptions={printOptions}
          printPreviewState={printPreviewState}
          setPrintPreviewState={setPrintPreviewState}
          setHtmlSections={setHtmlSections}
          view={view}
          ref={printPreviewRef}
        />}
        {statusMessage && !imagesLoaded && !errorMessages.length && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              height: '300px', // Adjust as needed
            }}
          >
            <CircularProgress />
            <Typography
              id="modal-modal-description"
              sx={{ mt: 2, textAlign: "center" }}
            >
              {statusMessage}
            </Typography>
          </Box>
        )}
      </Card>
      {serverInfo && (
        <SelectResourceToPreviewModal
          canLoad={htmlSections?.body != "" || errorMessages.length > 0 || (urlInfo && !urlInfo.repo)}
          showModal={showSelectResourceModal}
          setShowModal={setShowSelectResourceModal}
          serverInfo={serverInfo}
          urlInfo={urlInfo}
          currentCatalogEntry={catalogEntry}
        />
      )}
    </Sheet>
  )
}
