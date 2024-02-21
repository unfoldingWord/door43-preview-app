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
import { random } from "lodash";

export default function AppWorkspace() {
  const [showSelectResourceModal, setShowSelectResourceModal] = useState(false);
  const [scrollDocumentAnchor, setScrollDocumentAnchor] = useState();
  const [view, setView] = useState("web");
  const [waitPreviewStart, setWaitPreviewStart] = useState(true);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [printPreviewState, setPrintPreviewState] = useState("not started");

  const {
    state: {
      repo,
      urlInfo,
      catalogEntry,
      resourceComponent,
      statusMessage,
      errorMessages,
      html,
      webCss,
      printCss,
      canChangeColumns,
      buildInfo,
      serverInfo,
      isOpenPrint,
      printOptions,
      documentReady,
      documentAnchor,
    },
    actions: {
      clearErrorMessage,
      setIsOpenPrint,
      setPrintOptions,
      setErrorMessage,
      setDocumentReady,
    },
  } = useContext(AppContext)

  const webPreviewRef = useRef()
  const printPreviewRef = useRef()
  const printReachtComponent = useReactToPrint({
    content: () => printPreviewRef.current,
  })
  const handlePrint = () => {
    if(printPreviewState != "rendered") {
      alert("The document is not yet ready to print. Please wait...")
      return false
    }
    printReachtComponent()
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
    openPrintDrawer: isOpenPrint && html != "",
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

  useEffect(() => {
    document.addEventListener("scroll", {
      currentId: "",
      handleEvent: function (e) {
        if (this.currentID) {
          const currentElement = document.querySelector(
            `[id='${this.currentID}']`
          )
          if (currentElement) {
            const currentRect = currentElement.getBoundingClientRect()
            if (currentRect.top > 0 && currentRect.top < 150) {
              return
            }
          }
        }
        let found = ""
        const elements = document.querySelectorAll(".header-anchor")
        elements.forEach((e) => {
          if (found) {
            return
          }
          const rect = e.getBoundingClientRect()
          if (rect.top > 0 && rect.top < 150) {
            found = e.id
            console.log("FOUND ANCHOR", e.id, scrollDocumentAnchor)
            this.currentID = e.id
            setScrollDocumentAnchor(e.id)
          }
        })
      },
    })
  }, [])

  useEffect(() => {
    console.log("SETTING ANCHOR", documentAnchor)
    if (documentAnchor) {
      updateUrlHashInAddressBar(documentAnchor)
      setScrollDocumentAnchor(documentAnchor)
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
        console.log("IMAGES DONE! DOC READY!")
        setImagesLoaded(true)
      })
    }

    setImagesLoaded(false)
    if (html) {
      determineIfImagesLoaded()
    } else {
      console.log("HTML IS EMPTY! DOC NOT READY!")
    }
  }, [html, view])

  useEffect(() => {
    console.log("SETTING DR:", view, imagesLoaded, printPreviewState)
    setDocumentReady(
      (view == "web" && imagesLoaded) ||
        (view == "print" && printPreviewState == "rendered")
    )
  }, [imagesLoaded, printPreviewState])

  useEffect(() => {
    const scrollToLastAnchor = async () => {
      console.log("GOING TO SCROLL TO SDA", scrollDocumentAnchor, view, waitPreviewStart)
      if (scrollDocumentAnchor) {
        if (waitPreviewStart) {
          await new Promise((r) => setTimeout(r, 500))
          setWaitPreviewStart(false)
        }
        const elementToScrollTo = document.querySelector(
          `[id='${scrollDocumentAnchor}']`
        )
        if (elementToScrollTo) {
          console.log("SCROLLING TO", scrollDocumentAnchor)
          window.scrollTo({
            top:
              elementToScrollTo.getBoundingClientRect().top + window.scrollY - 40,
          })
        }
      }
    }

    if (html && Object.keys(printOptions).length && (view == "web" || printPreviewState != "not started")) {
      scrollToLastAnchor()
    }
  }, [view, printPreviewState, html, printOptions])

  useEffect(() => {
    const scrollToUrlAnchor = async () => {
      console.log("Scrolling to URL DA:", documentAnchor)
      if (documentAnchor) {
        if (waitPreviewStart) {
          await new Promise((r) => setTimeout(r, 1000))
          setWaitPreviewStart(false)
        }
        const elementToScrollTo = document.querySelector(
          `[id='${documentAnchor}']`
        )
        if (elementToScrollTo) {
          console.log("SCROLLING!!!!!")
          window.scrollTo({
            top: elementToScrollTo.getBoundingClientRect().top + window.scrollY,
            behavior: "smooth",
          })
          setScrollDocumentAnchor(documentAnchor)
        }
      }
    }


    if (html && documentAnchor) {
      scrollToUrlAnchor()
    }
  }, [html, documentAnchor])

  const sample =
    "https://vivliostyle.github.io/vivliostyle_doc/samples/gon/index.html"

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
        {html && <PrintDrawer {...printDrawerProps} />}
        <AppBar
          position="relative"
          sx={{ backgroundColor: "white", position: "sticky", top: "0" }}
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
            {resourceComponent}
            <div style={{ whiteSpace: "nowrap" }}>
              <ToggleButtonGroup
                value={html && view}
                exclusive
                onChange={(e, value) => {
                  setWaitPreviewStart(true)
                  setView(value)
                }}
                aria-label="View"
                disabled={!html}
              >
                <ToggleButton value="web" aria-label="Web view">
                  <Tooltip title="Web view" arrow>
                    <WebIcon />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton
                  value="print"
                  aria-label="Print view"
                  disabled={!imagesLoaded}
                >
                  <Tooltip title="Print view" arrow>
                    <MenuBookIcon />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
              <Tooltip title="Print" arrow>
                <IconButton disabled={!imagesLoaded}>
                  <PrintIcon
                    onClick={() => {
                      setView("print")
                      setIsOpenPrint(true)
                    }}
                  />
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
        {view == "web" ? (
          <WebPreviewComponent
            html={html}
            webCss={webCss + printCss}
            style={{
              direction: catalogEntry ? catalogEntry.language_direction : "ltr",
            }}
            ref={webPreviewRef}
          />
        ) : (
          ""
        )}
          <PrintPreviewComponent
            html={html}
            printPreviewState={printPreviewState}
            setPrintPreviewState={setPrintPreviewState}
            printOptions={printOptions}
            webCss={webCss}
            printCss={printCss}
            show={view == "print" || printPreviewState == "not started" || printPreviewState == "started"}
            style={{
              direction: catalogEntry ? catalogEntry.language_direction : "ltr",
            }}
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
          canLoad={html != ""}
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
