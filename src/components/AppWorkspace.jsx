// React imports
import { useState, useEffect, useContext, useRef } from 'react';

// Material UI imports
import { AppBar, CircularProgress, ToggleButton, ToggleButtonGroup, Toolbar, Typography } from '@mui/material';
import { Alert, Box, Card, IconButton, Sheet, Tooltip } from '@mui/joy';
import {
  Close as CloseIcon,
  CloseRounded as CloseRoundedIcon,
  FitScreen as FitScreenIcon,
  KeyboardDoubleArrowUp as KeyboardDoubleArrowUpIcon,
  MenuBook as MenuBookIcon,
  Print as PrintIcon,
  Report as ReportIcon,
  Web as WebIcon,
} from '@mui/icons-material';

// Component imports
import PrintDrawer from '@components/PrintDrawer';
import Header from '@components/Header';
import SelectResourceToPreviewModal from '@components/SelectResourceToPreviewModal';
import { ResourcesCardGrid } from '@components/ResourcesCardGrid';
import { ResourceLanguagesAccordion } from '@components/ResourceLanguagesAccordion';
import { WebPreviewComponent } from '@components/WebPreviewComponent';
import { PrintPreviewComponent } from '@components/PrintPreviewComponent';

// Context imports
import { AppContext } from '@components/App.context';

// Constants imports
import { APP_NAME, DCS_SERVERS } from '@common/constants';

// Helper imports
import { useReactToPrint } from 'react-to-print';
import { updateUrlHashInAddressBar } from '@helpers/url';

export default function AppWorkspace() {
  const [showSelectResourceModal, setShowSelectResourceModal] = useState(false);
  const [view, setView] = useState('web');
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [isAtTop, setIsAtTop] = useState(window.scrollY === 0);
  const [scrolledToAnchorInView, setScrolledToAnchorInView] = useState({
    view: '',
    documentAnchor: '',
  });

  const {
    state: {
      repo,
      urlInfo,
      catalogEntry,
      ResourceComponent,
      statusMessage,
      errorMessages,
      htmlSections,
      serverInfo,
      isOpenPrint,
      documentAnchor,
      printPreviewStatus,
      printPreviewPercentDone,
    },
    actions: { clearErrorMessage, setIsOpenPrint, setDocumentAnchor, setDocumentReady },
  } = useContext(AppContext);

  const webPreviewRef = useRef();
  const printPreviewRef = useRef();

  const currentViewRef = useRef(view == 'web' ? webPreviewRef : printPreviewRef);

  const printReactComponent = useReactToPrint({
    documentTitle: `${catalogEntry?.owner}--${catalogEntry?.repo.name}--${catalogEntry?.branch_or_tag_name}`,
    content: () => printPreviewRef.current,
  });
  const handlePrint = () => {
    if (printPreviewStatus != 'ready') {
      alert('The print preview is not done yet. Please wait...');
      return false;
    }
    printReactComponent();
  };

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
    openPrintDrawer: isOpenPrint && htmlSections?.body != '',
    onClosePrintDrawer: () => {
      setIsOpenPrint(false);
    },
    canChangeAtts: false,
    handlePrint,
  };

  let dcsRef = '';
  let infoLine = null;
  if (urlInfo && urlInfo.owner && urlInfo.repo && serverInfo?.baseUrl) {
    let repoFullName = ``;
    if (repo) {
      repoFullName = repo.full_name;
    } else {
      repoFullName = `${urlInfo.owner}/${urlInfo.repo}`
    }
    dcsRef = `${serverInfo?.baseUrl}/${repoFullName}`;
    if (catalogEntry) {
      dcsRef += `/src/${catalogEntry.ref_type}/${catalogEntry.branch_or_tag_name}`;
    } else {
      dcsRef += `/src/branch/${urlInfo.ref || repo?.default_branch || 'master'}`;
    }
    let infoLineInner = <>{repoFullName}</>;
    if (catalogEntry?.branch_or_tag_name) {
      if (catalogEntry.ref_type == 'branch') {
        infoLineInner = (
          <>
            {repoFullName}, {catalogEntry.branch_or_tag_name} <span style={{ fontStyle: 'italic' }}>({catalogEntry.commit_sha?.substring(0, 8)})</span>
          </>
        );
      } else {
        infoLineInner = (
          <>
            {repoFullName}, {catalogEntry.branch_or_tag_name}
          </>
        );
      }
    }

    infoLine = (
      <a href={dcsRef} target={'_blank'} style={{ textDecoration: 'none', color: 'inherit' }} rel="noreferrer">
        {infoLineInner}
      </a>
    );
  }

  let title = APP_NAME;
  if (serverInfo?.ID && serverInfo?.ID != DCS_SERVERS['prod'].ID) {
    title += ` (${serverInfo.ID})`;
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
    backdropFilter: 'none',
  };

  const scrollToAnchor = (myAnchor, myRef, myView) => {
    if (myAnchor && myRef?.current?.innerHTML) {
      let elementToScrollTo = myRef.current.querySelector(`[id='${myAnchor}']`);
      if (!elementToScrollTo) {
        elementToScrollTo = myRef.current.querySelector(`[id='hash-${myAnchor}']`);
      }
      if (elementToScrollTo) {
        window.scrollTo({
          top: elementToScrollTo.getBoundingClientRect().top + window.scrollY - document.querySelector('header').offsetHeight - 5,
        });
        return true;
      } else {
        console.log(`ERROR: Unable to find anchor ${myAnchor} in ${myView} view`);
      }
    }
    return false;
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsAtTop(window.scrollY <= 20);
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    currentViewRef.current = view == 'web' ? webPreviewRef : printPreviewRef;
  }, [view]);

  useEffect(() => {
    const handleClick = (e) => {
      const a = e.target.closest('a');
      if (!a) {
        return;
      }
      let href = a.getAttribute('href');
      if (href && href.startsWith('#')) {
        href = href.replace(/^#/, '');
        if (href.startsWith('hash-')) {
          console.log('SET DOCUMENT ANCHOR', href);
          href = href.replace(/^hash-/, '');
          setDocumentAnchor(href);
        } else {
          console.log('Scrolling without setting to: ', href);
          scrollToAnchor(href, currentViewRef.current, view);
        }
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.querySelector('#root').addEventListener('click', handleClick);
    return () => {
      document.querySelector('#root').removeEventListener('click', handleClick);
    };
  }, [setDocumentAnchor]);

  useEffect(() => {
    if (documentAnchor) {
      updateUrlHashInAddressBar(documentAnchor);
    }
  }, [documentAnchor]);

  useEffect(() => {
    const determineIfImagesLoaded = async () => {
      Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise((resolve) => {
                img.onload = img.onerror = resolve;
              })
          )
      ).then(() => {
        console.log('IMAGES DONE. DOC READY.');
        setImagesLoaded(true);
      });
    };

    setImagesLoaded(false);
    if (htmlSections?.body) {
      determineIfImagesLoaded();
    } else {
      console.log('HTML IS EMPTY. DOC NOT READY.');
    }
  }, [htmlSections?.body, view]);

  useEffect(() => {
    setDocumentReady((view == 'web' && imagesLoaded) || (view == 'print' && printPreviewStatus == 'ready'));
  }, [imagesLoaded, printPreviewStatus]);

  useEffect(() => {
    if (currentViewRef.current?.current?.innerHTML && documentAnchor && (scrolledToAnchorInView.view != view || scrolledToAnchorInView.documentAnchor != documentAnchor)) {
      console.log('SCROLLING TO DOCUMENT ANCHOR: ', documentAnchor);
      const didScroll = scrollToAnchor(documentAnchor, currentViewRef.current, view);
      if (didScroll) {
        setScrolledToAnchorInView({ view, documentAnchor });
      }
    }
  }, [view, documentAnchor, currentViewRef?.current?.current?.innerHTML, scrolledToAnchorInView]);

  return (
    <Sheet>
      {!fullScreen &&
        (window.location.hostname == 'preview.door43.org' ||
          window.location.hostname.includes('netlify') ||
          window.location.host == 'localhost:5173' ||
          window.location.host == 'localhost:4173') && (
          <Header title={title} dcsRef={dcsRef} infoLine={infoLine} onOpenClick={() => setShowSelectResourceModal(!showSelectResourceModal)} />
        )}
      <Card>
        {htmlSections?.body && <PrintDrawer {...printDrawerProps} />}
        {fullScreen && (
          <Tooltip title="Close full screen" arrow>
            <IconButton
              onClick={() => setFullScreen(false)}
              sx={{
                position: 'sticky',
                top: 0,
                marginLeft: 'auto',
                backgroundColor: 'white',
                zIndex: 999,
              }}
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>
        )}
        {urlInfo && urlInfo.repo && (
          <AppBar
            position="relative"
            sx={{
              backgroundColor: 'white',
              position: 'sticky',
              top: '0',
              color: 'black',
              zIndex: 999,
            }}
          >
            <Toolbar
              sx={{
                display: !fullScreen ? 'flex' : 'none',
                justifyContent: 'space-between',
                width: '100%',
                height: '10px',
                overflowX: 'scroll',
                paddingTop: '10px',
                paddingBottom: '10px',
              }}
            >
              <div>&nbsp;</div>
              {ResourceComponent ? <ResourceComponent /> : ''}
              <div style={{ whiteSpace: 'nowrap' }}>
                <ToggleButtonGroup
                  value={view}
                  exclusive
                  onChange={(e, value) => {
                    if (value !== null) {
                      let ok = true;
                      if (view == 'print' && value == 'web' && printPreviewPercentDone < 100) {
                        ok = window.confirm('Switching to web view will cancel the print preview rendering. Are you sure?');
                      }
                      if (ok) {
                        setView(value);
                      }
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
                  <ToggleButton value="print" aria-label="Print view" disabled={!htmlSections?.body}>
                    <Tooltip title="Print view" arrow>
                      <MenuBookIcon />
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
                <Tooltip
                  title={`Print Preview Status: ${printPreviewStatus}${printPreviewPercentDone < 100 && printPreviewPercentDone > 0 ? `, ${printPreviewPercentDone}%` : ''}`}
                  arrow
                >
                  <IconButton disabled={!htmlSections.body}>
                    <PrintIcon
                      sx={{ zIndex: 2 }}
                      onClick={() => {
                        setView('print');
                        setIsOpenPrint(true);
                      }}
                    />
                    <CircularProgress
                      variant="determinate"
                      value={100}
                      size={32} // adjust to match the size of the icon
                      sx={{
                        position: 'absolute',
                        zIndex: 1,
                        color: 'grey',
                      }}
                    />
                    <CircularProgress
                      variant="determinate"
                      value={printPreviewPercentDone}
                      size={32} // adjust to match the size of the icon
                      sx={{
                        position: 'absolute',
                        zIndex: 1,
                        color: printPreviewPercentDone < 50 ? 'red' : printPreviewPercentDone < 100 ? 'orange' : 'green',
                      }}
                    />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Full screen" arrow>
                  <IconButton onClick={() => setFullScreen(true)}>
                    <FitScreenIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Back to top" arrow>
                  <IconButton onClick={() => window.scrollTo({ top: 0 })} disabled={isAtTop}>
                    <KeyboardDoubleArrowUpIcon />
                  </IconButton>
                </Tooltip>
              </div>
            </Toolbar>
          </AppBar>
        )}
        {errorMessages.map((message, i) => (
          <Alert
            key={`errorMessage${i}`}
            sx={{ alignItems: 'flex-start' }}
            startDecorator={<ReportIcon />}
            variant="soft"
            color="danger"
            endDecorator={
              <IconButton variant="soft" color="danger" onClick={() => clearErrorMessage(i)}>
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
        <div
          id="main-content"
          style={{
            position: 'relative',
            minHeight: printPreviewRef?.current ? printPreviewRef.current.clientHeight + 'px' : 'auto',
          }}
        >
          {urlInfo && urlInfo.owner == 'downloadables' && serverInfo && (
            <ResourceLanguagesAccordion
              serverInfo={serverInfo}
              subjects={[
                'Open Bible Stories',
                'OBS Study Notes',
                'OBS Study Questions',
                'OBS Translation Notes',
                'OBS Translation Questions',
                'TSV OBS Study Notes',
                'TSV OBS Study Questions',
                'TSV OBS Translation Notes',
                'TSV OBS Translation Questions',
              ]}
            />
          )}
          {urlInfo && !urlInfo.owner && serverInfo && <ResourcesCardGrid />}
          {urlInfo && urlInfo.owner && urlInfo.repo && serverInfo && view == 'web' && (
            <WebPreviewComponent
              ref={webPreviewRef}
              style={{
                backgroundColor: 'white',
                direction: catalogEntry ? catalogEntry.language_direction : 'ltr',
              }}
            />
          )}
          {urlInfo && urlInfo.owner && urlInfo.repo && serverInfo && (view == 'print' || printPreviewStatus == 'ready') && (
            <PrintPreviewComponent ref={printPreviewRef} view={view} />
          )}
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
              <Typography id="modal-modal-description" sx={{ mt: 2, textAlign: 'center' }}>
                {statusMessage}
              </Typography>
            </Box>
          )}
        </div>
      </Card>
      {serverInfo && (
        <SelectResourceToPreviewModal
          canLoad={htmlSections?.body != '' || errorMessages.length > 0 || (urlInfo && !urlInfo.repo)}
          showModal={showSelectResourceModal}
          setShowModal={setShowSelectResourceModal}
          serverInfo={serverInfo}
          urlInfo={urlInfo}
          currentCatalogEntry={catalogEntry}
        />
      )}
    </Sheet>
  );
}
