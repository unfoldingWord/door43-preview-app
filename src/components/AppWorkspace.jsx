import { useState, useEffect, useContext, useRef } from "react";
import {
  Typography,
  Modal,
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
import { APP_NAME, DCS_SERVERS, API_PATH } from "@common/constants";
import { useReactToPrint } from "react-to-print";
import { updateUrlHashInAddressBar } from "@utils/url";
import { WebPreviewComponent } from "./WebPreviewComponent";
import { PrintPreviewComponent } from "./PrintPreviewComponent";
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';


export default function AppWorkspace() {
  const [initialized, setInitialized] = useState(false)
  const [showSelectResourceModal, setShowSelectResourceModal] = useState(false)
  const [view, setView] = useState("web")
  const [waitPreviewStart, setWaitPreviewStart] = useState(true)
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
      buildInfo,
      serverInfo,
      isOpenPrint,
      printOptions,
      documentReady,
      documentAnchor,
      lastSeenAnchor,
    },
    actions: {
      onPrintClick,
      clearErrorMessage,
      setWebCss,
      setPrintCss,
      setStatusMessage,
      setErrorMessage,
      setCanChangeColumns,
      setHtmlSections,
      setIsOpenPrint,
      setPrintOptions,
      setDocumentAnchor,
      setDocumentReady,
      setLastSeenAnchor,
    },
  } = useContext(AppContext)

  const webPreviewRef = useRef()
  const printPreviewRef = useRef()
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

  const onUpArrowClick = (e) => {
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

  const scrollToAnchor = async (anchor) => {
    if (anchor) {
      if (waitPreviewStart) {
        await new Promise((r) => setTimeout(r, 500))
        setWaitPreviewStart(false)
      }
      let elementToScrollTo = document.querySelector(
        `#${view}-preview [id='${anchor}']`
      )
      // if (!elementToScrollTo) {
      //   elementToScrollTo = document.querySelector(
      //     `#${view}-preview [id='${view}-${anchor}']`
      //   )
      // }
      if (elementToScrollTo) {
        window.scrollTo({
          top: elementToScrollTo.getBoundingClientRect().top + window.scrollY - document.querySelector("header").offsetHeight - 5,
        })
      }
    }
  }

  useEffect(() => {
    const initalizeApp = async() => {
    setInitialized(true)
    document.querySelector('#root').addEventListener('click', e => {
      const a = e.target.closest("a")
      if (! a) {
        return
      }
      let href = a.getAttribute('href')
      if (href && href.startsWith('#')) {
        href = href.replace(/^#/, '')
        if (! href.startsWith('note-')) {
          console.log("SET DOCUMENT ANCHOR", href)
          setDocumentAnchor(href.replace(/^print-/, ''))
        } else {
          console.log("Scrolling without setting to: ", href)
          scrollToAnchor(href)
        }
        e.preventDefault()
        e.stopPropagation()
      }
    })

    document.addEventListener("scroll", {
      timer: null,
      handleEvent: function() {
        if(this.timer !== null) {
          clearTimeout(this.timer);        
        }
        this.timer = setTimeout(function() {
          let found = false
          const elements = document.querySelectorAll("section, article, span")
          elements.forEach((e) => {
            if (found || ! e.id) {
              return
            }
            const rect = e.getBoundingClientRect()
            if (rect.top > document.querySelector("header").offsetHeight && rect.top < 400) {
              found = true
              console.log("SETTING ANCHOR TO ", e.id.replace(/^print-/, ''))
              setLastSeenAnchor(e.id.replace(/^print-/, ''))
            }
          })
        }, 200)
      },
    }, false)
  }

    if (!initialized) {
      setInitialized(true)
      initalizeApp()
    }
  }, [initialized])

  useEffect(() => {
    if (documentAnchor) {
      updateUrlHashInAddressBar(documentAnchor)
      setLastSeenAnchor(documentAnchor)
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
    if (htmlSections?.body && Object.keys(printOptions).length && (view == "web" || printPreviewState != "not started")) {
      console.log("SCROLLING TO LAST SEEN ANCHOR: ", lastSeenAnchor)
      scrollToAnchor(lastSeenAnchor)
    }
  }, [view, printPreviewState, htmlSections?.body, printOptions])

  useEffect(() => {
    if (htmlSections?.body && documentAnchor) {
      console.log("SCROLLING TO DOCUMENT ANCHOR: ", documentAnchor)
      scrollToAnchor(documentAnchor)
    }
  }, [htmlSections?.body, documentAnchor])

  const resourceComponentProps = {
    urlInfo,
    serverInfo,
    catalogEntry,
    htmlSections,
    setHtmlSections,
    webCss,
    printCss,
    lastSeenAnchor,
    onPrintClick,
    setWebCss,
    setPrintCss,
    setStatusMessage,
    setErrorMessage,
    setCanChangeColumns,
    setDocumentAnchor,
  }

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
        <AppBar
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
            {ResourceComponent ? <ResourceComponent {...resourceComponentProps} /> : ""}
            <div style={{ whiteSpace: "nowrap" }}>
              <ToggleButtonGroup
                value={view}
                exclusive
                onChange={(e, value) => {
                  if (value !== null) {
                    setWaitPreviewStart(true)
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
        </AppBar>
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
        {view == "web" ?
        <WebPreviewComponent
          html={htmlSections.body}
          webCss={webCss + printCss}
          style={{
            display: view == "web" ? "block" : "none",
            direction: catalogEntry ? catalogEntry.language_direction : "ltr",
          }}
          ref={webPreviewRef}
        />: ""}
        <PrintPreviewComponent
          catalogEntry={catalogEntry}
          htmlSections={htmlSections}
          webCss={webCss}
          printCss={printCss}
          printOptions={printOptions}
          printPreviewState={printPreviewState}
          setPrintPreviewState={setPrintPreviewState}
          setHtmlSections={setHtmlSections}
          style={{
            display: view == "print" || printPreviewState == "not started" || printPreviewState == "started" ? "block" : "none",
            direction: catalogEntry ? catalogEntry.language_direction : "ltr",
          }}
          webPreviewRef={webPreviewRef}
          ref={printPreviewRef}
        />
        {statusMessage && !imagesLoaded && !errorMessages.length && (
          <Modal
            open={true}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
          >
            <Box sx={processModalStyle}>
              <Typography
                id="modal-modal-title"
                variant="h6"
                component="h2"
                sx={{ textAlign: "center" }}
              >
                <CircularProgress />
              </Typography>
              <Typography
                id="modal-modal-description"
                sx={{ mt: 2, textAlign: "center" }}
              >
                {statusMessage}
              </Typography>
            </Box>
          </Modal>
        )}
      </Card>
      {serverInfo && (
        <SelectResourceToPreviewModal
          canLoad={htmlSections?.body != ""}
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
