// React imports
import React, { useState, useEffect, useContext, useRef } from 'react';
import { Helmet } from 'react-helmet';

// Material UI imports
import { AppBar, CircularProgress, ToggleButton, ToggleButtonGroup, Toolbar, Typography, LinearProgress, Grid } from '@mui/material';
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
import LoadingBar from '@components/LoadingBar';
import Header from '@components/Header';
import SelectResourceToPreviewModal from '@components/SelectResourceToPreviewModal';
import { ResourcesCardGrid } from '@components/ResourcesCardGrid';
import { ResourceLanguagesAccordion } from '@components/ResourceLanguagesAccordion';
import { WebPreviewComponent } from '@components/WebPreviewComponent';
import { PrintPreviewComponent } from '@components/PrintPreviewComponent';

// Context imports
import { AppContext } from '@components/App.context';

// Constants imports
import { APP_NAME } from '@common/constants';
import { BibleBookData } from '@common/books';

// Helper imports
import { useReactToPrint } from 'react-to-print';
import { updateUrlHashInAddressBar } from '@helpers/url';
import { getColorForProgressBar } from '@helpers/loading';

export default function AppWorkspace() {
  const [showSelectResourceModal, setShowSelectResourceModal] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [isAtTop, setIsAtTop] = useState(window.scrollY === 0);
  const [hidePercentDone, setHidePercentDone] = useState(false);
  const [scrolledToAnchorInView, setScrolledToAnchorInView] = useState({
    view: '',
    navAnchor: '',
  });

  const {
    state: {
      urlInfo,
      repo,
      owner,
      catalogEntry,
      ResourceComponent,
      statusMessage,
      errorMessages,
      htmlSections,
      builtWith,
      cachedHtmlSections,
      serverInfo,
      isOpenPrint,
      navAnchor,
      printPreviewStatus,
      printPreviewPercentDone,
      renderMessage,
      bookId,
      bookTitle,
      view,
      expandedBooks,
    },
    actions: { clearErrorMessage, setIsOpenPrint, setNavAnchor, setDocumentReady, setView },
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
    openPrintDrawer: isOpenPrint && htmlSections?.body !== '',
    onClosePrintDrawer: () => {
      setIsOpenPrint(false);
    },
    canChangeAtts: false,
    handlePrint,
  };

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
      let elementToScrollTo = myRef.current.querySelector(`#nav-${myAnchor}`);
      if (!elementToScrollTo && !/^\d/.test(myAnchor)) {
        elementToScrollTo = myRef.current.querySelector(`#${myAnchor}`);
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
      if (href.startsWith('#')) {
        let anchor = href.replace('#', '');
        if (anchor.startsWith('nav-')) {
          console.log("SET NAV ANCHOR", anchor);
          const na = anchor.replace(/^nav-/, '');
          setNavAnchor(na);
          updateUrlHashInAddressBar(na);
        } else if (anchor) {
          if (anchor.split('-')[0] in BibleBookData && !(expandedBooks.includes(anchor.split('-')[0]))) {
            window.open(`#${anchor}`, '_blank');
          } else {
            console.log('Scrolling without setting to: ', anchor);
            scrollToAnchor(anchor, currentViewRef.current, view);
          }
        }
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.querySelector('#root').addEventListener('click', handleClick);
    return () => {
      document.querySelector('#root').removeEventListener('click', handleClick);
    };
  }, [view, expandedBooks, setNavAnchor]);

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
    if (currentViewRef.current?.current?.innerHTML && navAnchor && (scrolledToAnchorInView.view != view || scrolledToAnchorInView.navAnchor != navAnchor)) {
      console.log('SCROLLING TO NAV ANCHOR: ', navAnchor);
      const didScroll = scrollToAnchor(navAnchor, currentViewRef.current, view);
      if (didScroll) {
        setScrolledToAnchorInView({ view, navAnchor });
      }
    }
  }, [view, navAnchor, currentViewRef?.current?.current?.innerHTML, scrolledToAnchorInView]);

  useEffect(() => {
    if (printPreviewPercentDone === 100) {
      const timeoutId = setTimeout(() => {
        setHidePercentDone(true);
      }, 5000);

      return () => clearTimeout(timeoutId); // Clean up on unmount
    } else if (hidePercentDone) {
      setHidePercentDone(false);
    }
  }, [printPreviewPercentDone, hidePercentDone]);

  return (<>
    <Helmet>
     <title>{repo && repo.metadata_type ? `${repo.title} (${repo.abbreviation})${bookTitle && ` - ${bookTitle} (${bookId})`} - ${repo.language_title} (${repo.language})` : APP_NAME}</title>
      <meta name="description" content={`unrestricted biblical content in every language; ${repo?.description}`} />
      <meta name="keywords" content={`door43, unfoldingWord, bible, jesus${repo && `, ${repo.owner.full_name}, ${repo.owner.username}, ${repo.subject}, ${repo.language_title}, ${repo.language}`}`} />
      <html lang={repo ? repo.language : 'en'} />
    </Helmet>
    <Sheet>
      {!fullScreen &&
        <Header serverInfo={serverInfo} urlInfo={urlInfo} repo={repo} owner={owner} catalogEntry={catalogEntry} bookId={expandedBooks?.[0]} bookTitle={bookTitle} builtWith={builtWith} onOpenClick={() => setShowSelectResourceModal(!showSelectResourceModal)} />
      }
      <Card sx={{backgroundColor: (urlInfo?.repo ? 'white' : 'lightgrey'), border: 'none', borderRadius: 'none'}}>
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
            {view === 'print' && !hidePercentDone && (
              <Tooltip title="Preview Rendering Status" arrow>
                <LinearProgress
                  variant="determinate"
                  value={printPreviewPercentDone}
                  sx={{
                    height: 5,
                    backgroundColor: 'grey',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: printPreviewPercentDone < 100 ? getColorForProgressBar(printPreviewPercentDone / 100) : 'green',
                    },
                  }}
                />
              </Tooltip>
            )}
            {view === 'web' && !htmlSections.body && !errorMessages && (
              <LoadingBar
                message={renderMessage}
              />
            )}
          </AppBar>
        )}
        {errorMessages &&
          errorMessages.map((message, i) => (
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
          {statusMessage && !htmlSections?.body && !cachedHtmlSections?.body && !errorMessages && (
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
          {!urlInfo?.repo && serverInfo && <ResourcesCardGrid />}
          {urlInfo?.repo && serverInfo && view == 'web' && (
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
        </div>
      </Card>
      {serverInfo && (
        <SelectResourceToPreviewModal
          canLoad={htmlSections?.body !== '' || errorMessages != null || !(urlInfo?.repo)}
          showModal={showSelectResourceModal}
          setShowModal={setShowSelectResourceModal}
        />
      )}
    </Sheet>
  </>);
}
