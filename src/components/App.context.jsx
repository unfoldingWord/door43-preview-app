// React imports
import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
// import AWS from 'aws-sdk';

const S3_BUCKET_NAME = 'preview.door43.org';


// Constants
import { DCS_SERVERS, API_PATH } from '@common/constants';

// Helper functions
import { getCatalogEntry } from '@helpers/dcsApi';

// Converter components
import Bible from '@components/Bible';
import OpenBibleStories from '@components/OpenBibleStories';
import RcTranslationAcademy from '@components/RcTranslationAcademy';
import RcTranslationNotes from '@components/RcTranslationNotes';
import RcTranslationQuestions from '@components/RcTranslationQuestions';
import RcTranslationWords from '@components/RcTranslationWords';
// import RcObsTranslationNotes from '@libs/rcObsTranslationNotes/components/RcObsTranslationNotes' // Uncomment this if you need to use RcObsTranslationNotes
import TsBible from '@components/TsBible';

export const AppContext = React.createContext();

export function AppContextProvider({ children }) {
  const [statusMessage, setStatusMessage] = useState(
    <>
      Preparing Preview.
      <br />
      Please wait...
    </>
  );
  const [errorMessages, setErrorMessages] = useState([]);
  const [urlInfo, setUrlInfo] = useState();
  const [serverInfo, setServerInfo] = useState();
  const [buildInfo, setBuildInfo] = useState();
  const [repo, setRepo] = useState();
  const [catalogEntry, setCatalogEntry] = useState();
  const [ResourceComponent, setResourceComponent] = useState();
  const [htmlSections, setHtmlSections] = useState({ cover: '', copyright: '', toc: '', body: '' });
  const [webCss, setWebCss] = useState('');
  const [printCss, setPrintCss] = useState('');
  const [canChangeColumns, setCanChangeColumns] = useState(false);
  const [isOpenPrint, setIsOpenPrint] = useState(false);
  const [printOptions, setPrintOptions] = useState({});
  const [documentReady, setDocumentReady] = useState(false);
  const [documentAnchor, setDocumentAnchor] = useState('');
  const [printPreviewStatus, setPrintPreviewStatus] = useState('not started');
  const [printPreviewPercentDone, setPrintPreviewPercentDone] = useState(0);

  const onPrintClick = () => {
    setIsOpenPrint(true);
  };

  const setErrorMessage = useCallback(
    (message) => {
      setErrorMessages((prevErrorMessages) => {
        if (!prevErrorMessages.includes(message)) {
          return [...prevErrorMessages, message];
        }
        return prevErrorMessages;
      });
    },
    [setErrorMessages]
  );

  const clearErrorMessage = (idxToRemove) => {
    if (errorMessages.length > idxToRemove) {
      errorMessages.splice(idxToRemove, 1);
      setErrorMessages(errorMessages.map((value, idx) => idx != idxToRemove));
    }
  };

  useEffect(() => {
    const url = new URL(window.location.href);

    const getServerInfo = async () => {
      const server = url.searchParams.get('server')?.toLowerCase();
      if (server) {
        if (server in DCS_SERVERS) {
          setServerInfo(DCS_SERVERS[server.toLowerCase()]);
        } else {
          let baseUrl = server;
          if (!server.startsWith('http')) {
            baseUrl = `http${server.includes('door43.org') ? 's' : ''}://${server}`;
          }
          setServerInfo({ baseUrl, ID: server });
        }
      } else if (url.hostname.match(/^(git|preview)\.door43\.org/)) {
        setServerInfo(DCS_SERVERS['prod']);
      } else if (url.hostname == 'develop.door43.org') {
        setServerInfo(DCS_SERVERS['dev']);
      } else {
        setServerInfo(DCS_SERVERS['qa']);
      }
    };

    const getUrlInfo = async () => {
      const urlParts = url.pathname
        .replace(/^\/(u\/){0,1}/, '')
        .replace(/\/+$/, '')
        .replace(/\/preview\//, '/')
        .replace(/\/(branch|tag)\//, '/')
        .split('/');
      const info = {
        owner: urlParts[0] || '',
        repo: urlParts[1] || '',
        ref: urlParts[2] == 'preview' ? urlParts.slice(3).join('/') : urlParts.slice(2).join('/'),
        hash: url.hash.replace('#', ''),
        hashParts: url.hash ? url.hash.replace('#', '').split('-') : [],
      };

      // The below is handling old door43.org links which had books and stories as .html files
      // Can be removed if we no longer care about handling old door43.org links
      // Examples:
      // * OLD: /u/unfoldingWord/en_ult/master/01-GEN.html
      //   -> NEW: /u/unfoldingWord/en_ult/master#gen
      // * OLD: /u/unfoldingWord/en_ta/v79/03-translate.html#translate-manual
      //   -> NEW: /u/unfoldingWord/en_ta/v79/#translate--translate-manual
      // * OLD: /u/unfoldingWord/en_obs/master/01.html
      //   -> NEW: /u/unfoldingWord/en_obs/master#obs-1
      // * OLD: /u/unfoldingWord/en_tw/master/other.html#acknowledge
      //   -> NEW: /u/unfoldingWord/en_tw/master/#other--acknowledge
      const match = info.ref.match(/^(.*)\/(\d+-)*([^/]+)\.html$/);
      if (match) {
        info.ref = match[1];
        info.hash = match[3].toLowerCase() + (info.hash ? `--${info.hash}` : '');
        if (/^\d+$/.test(info.hash)) {
          info.hash = 'obs-' + parseInt(info.hash, 10);
        }
        info.hash = info.hash.replace('tw-section-', '');
        info.hashParts = [info.hash];
        url.pathname = url.pathname.replace(/[^/]+.html$/, '');
        url.hash = `#${info.hash}`;
        window.history.replaceState({}, document.title, url.toString());
      }
      setUrlInfo(info);
      setDocumentAnchor(info.hash);
      if (!info.repo) {
        setStatusMessage('');
      }
    };

    getServerInfo().catch((e) => setErrorMessage(e.message));
    getUrlInfo().catch((e) => setErrorMessage(e.message));
  }, [setErrorMessage]);

  useEffect(() => {
    const fetchRepo = async () => {
      const repoUrl = `${serverInfo.baseUrl}/${API_PATH}/repos/${urlInfo.owner}/${urlInfo.repo}`;
      fetch(repoUrl)
        .then((response) => {
          if (response.ok) {
            return response.json();
          } else {
            throw new Error(`Repository not found: ${urlInfo.owner}/${urlInfo.repo}`);
          }
        })
        .then((data) => {
          setRepo(data);
        })
        .catch(() => {
          setErrorMessage(
            <>
              Failed to get resource. Unable to fetch{' '}
              <a href={repoUrl} target="_blank" rel="noreferrer">
                {urlInfo.owner}/{urlInfo.repo}
              </a>
            </>
          );
        });
    };

    if (serverInfo && urlInfo && urlInfo.owner && urlInfo.repo) {
      fetchRepo().catch((e) => setErrorMessage(e.message));
    }
  }, [serverInfo, urlInfo, setErrorMessage]);

  useEffect(() => {
    const fetchCatalogEntry = async () => {
      getCatalogEntry(`${serverInfo.baseUrl}/${API_PATH}/catalog`, repo.owner.username, repo.name, urlInfo.ref || repo.default_branch)
        .then((entry) => setCatalogEntry(entry))
        .catch((err) => setErrorMessage(err.message));
    };

    if (repo) {
      fetchCatalogEntry().catch((e) => setErrorMessage(e.message));
    }
  }, [repo, serverInfo, urlInfo, setErrorMessage]);

  useEffect(() => {
    if (catalogEntry) {
      if (!catalogEntry.subject || !catalogEntry.ingredients || !catalogEntry.metadata_type) {
        if (catalogEntry.repo?.title && catalogEntry.repo?.subject && catalogEntry.repo?.ingredients && catalogEntry.repo?.metadata_type) {
          catalogEntry.title = catalogEntry.repo.title;
          catalogEntry.subject = catalogEntry.repo.subject;
          catalogEntry.ingredients = catalogEntry.repo.ingredients;
          catalogEntry.metadata_type = catalogEntry.repo.metadata_type;
          catalogEntry.flavor_type = catalogEntry.repo.flavor_type;
          catalogEntry.flavor = catalogEntry.repo.flavor;
        } else {
          setErrorMessage(`This references an invalid ${catalogEntry.ref_type ? catalogEntry.ref_type : 'entry'}. Unable to determine its type and/or ingredients.`);
          return;
        }
      }
      if (catalogEntry.metadata_type && catalogEntry.subject) {
        switch (catalogEntry.metadata_type) {
          case 'rc':
            switch (catalogEntry.subject) {
              case 'Aligned Bible':
              case 'Bible':
              case 'Greek New Testament':
              case 'Hebrew Old Testament':
                setResourceComponent(() => Bible);
                return;
              case 'Open Bible Stories':
                setResourceComponent(() => OpenBibleStories);
                return;
              case 'Translation Academy':
                setResourceComponent(() => RcTranslationAcademy);
                return;
              case 'TSV Translation Notes':
                setResourceComponent(() => RcTranslationNotes);
                return;
              case 'TSV Translation Questions':
                setResourceComponent(() => RcTranslationQuestions);
                return;
              case 'Translation Words':
                setResourceComponent(() => RcTranslationWords);
                return;
              case 'TSV OBS Translation Notes':
                // setResourceComponent(() => RcObsTranslationNotes)
                return;
              default:
                setErrorMessage(`Conversion of \`${catalogEntry.subject}\` resources is currently not supported.`);
            }
            return;
          case 'sb':
            switch (catalogEntry.flavor_type) {
              case 'scripture':
                switch (catalogEntry.flavor) {
                  case 'textTranslation':
                    setResourceComponent(() => Bible);
                    return;
                  default:
                    setErrorMessage(`Conversion of SB flavor \`${catalogEntry.flavor}\` is not currently supported.`);
                }
                return;
              case 'gloss':
                switch (catalogEntry.flavor) {
                  case 'textStories':
                    setResourceComponent(() => OpenBibleStories);
                    return;
                }
                return;
              default:
                setErrorMessage(`Conversion of SB flavor type \`${catalogEntry.flavor_type}\` is not currently supported.`);
            }
            return;
          case 'ts':
            switch (catalogEntry.subject) {
              case 'Open Bible Stories':
                setResourceComponent(() => OpenBibleStories);
                return;
              case 'Bible':
                setResourceComponent(() => TsBible);
                return;
              default:
                setErrorMessage('Conversion of translationStudio repositories is currently not supported.');
            }
            return;
          case 'tc':
            switch (catalogEntry.subject) {
              case 'Aligned Bible':
              case 'Bible':
                setResourceComponent(() => Bible);
                return;
              default:
                setErrorMessage(`Conversion of translationCore \`${catalogEntry.subject}\` repositories is currently not supported.`);
            }
            return;
        }
      }
      setErrorMessage(`Not a valid repository that can be convert.`);
    }
  }, [catalogEntry, setErrorMessage]);

  useEffect(() => {
    if (htmlSections && htmlSections.html && htmlSections.copyright) {
        // const s3 = new AWS.S3({
        //   // Configure S3 with temporary credentials obtained from Netlify
        //   credentials: {
        //     accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
        //     secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
        //     sessionToken: process.env.REACT_APP_AWS_SESSION_TOKEN,
        //   },
        // });
  
        // const params = {
        //   Bucket: S3_BUCKET_NAME,
        //   Key: selectedFile.name, // File name in S3 bucket
        //   Body: selectedFile,
        // };
  
        // s3.upload(params).promise().then(() => {
        //   console.log("JSON UPLOADED");
        // }).error(e => {
        //   console.error(e);
        // });
    }

  }, [htmlSections])

  // create the value for the context provider
  const context = {
    state: {
      urlInfo,
      catalogEntry,
      statusMessage,
      errorMessages,
      repo,
      ResourceComponent,
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
      printPreviewStatus,
      printPreviewPercentDone,
    },
    actions: {
      onPrintClick,
      setStatusMessage,
      setErrorMessage,
      clearErrorMessage,
      setHtmlSections,
      setWebCss,
      setPrintCss,
      setCanChangeColumns,
      setIsOpenPrint,
      setPrintOptions,
      setDocumentReady,
      setDocumentAnchor,
      setPrintPreviewStatus,
      setPrintPreviewPercentDone,
    },
  };

  return <AppContext.Provider value={context}>{children}</AppContext.Provider>;
}

AppContextProvider.propTypes = {
  /** Children to render inside of Provider */
  children: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.node), PropTypes.node]).isRequired,
};
