// React imports
import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { BibleBookData } from '@common/books';
import { downloadCachedBook, uploadCachedBook } from '@helpers/books';

// Constants
import { DCS_SERVERS, API_PATH, APP_VERSION } from '@common/constants';

// Helper functions
import { getCatalogEntry, getRepo, getOwner } from '@helpers/dcsApi';

// Converter components
import Bible from '@components/Bible';
import OpenBibleStories from '@components/OpenBibleStories';
import RcTranslationAcademy from '@components/RcTranslationAcademy';
import RcTranslationNotes from '@components/RcTranslationNotes';
import RcTranslationQuestions from '@components/RcTranslationQuestions';
import RcTranslationWords from '@components/RcTranslationWords';
// import RcObsTranslationNotes from '@libs/rcObsTranslationNotes/components/RcObsTranslationNotes' // Uncomment this if you need to use RcObsTranslationNotes
import TsBible from '@components/TsBible';
import { set } from 'lodash';

export const AppContext = React.createContext();

export function AppContextProvider({ children }) {
  const [statusMessage, setStatusMessage] = useState(
    <>
      Preparing Preview.
      <br />
      Please wait...
    </>
  );
  const [errorMessages, setErrorMessages] = useState();
  const [urlInfo, setUrlInfo] = useState();
  const [serverInfo, setServerInfo] = useState();
  const [repo, setRepo] = useState();
  const [owner, setOwner] = useState();
  const [catalogEntry, setCatalogEntry] = useState();
  const [ResourceComponent, setResourceComponent] = useState();
  const [bookId, setBookId] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [supportedBooks, setSupportedBooks] = useState([]);
  const [htmlSections, setHtmlSections] = useState({ css: { web: '', print: '' }, cover: '', copyright: '', toc: '', body: '' });
  const [canChangeColumns, setCanChangeColumns] = useState(false);
  const [isOpenPrint, setIsOpenPrint] = useState(false);
  const [printOptions, setPrintOptions] = useState({});
  const [documentReady, setDocumentReady] = useState(false);
  const [documentAnchor, setDocumentAnchor] = useState('');
  const [printPreviewStatus, setPrintPreviewStatus] = useState('not started');
  const [printPreviewPercentDone, setPrintPreviewPercentDone] = useState(0);
  const [authToken, setAuthToken] = useState();
  const [builtWith, setBuiltWith] = useState([]);
  const [cachedBook, setCachedBook] = useState();
  const [cachedHtmlSections, setCachedHtmlSections] = useState();
  const [fetchingCachedBook, setFetchingCachedBook] = useState(false);
  const [renderMessage, setRenderMessage] = useState(''); // Gives reason for rendering, also a flag that a new render is needed
  const [noCache, setNoCache] = useState(false);
  const [fetchingCatalogEntry, setFetchingCatalogEntry] = useState(false);

  const onPrintClick = () => {
    setIsOpenPrint(true);
  };

  const setErrorMessage = useCallback(
    (message) => {
      setErrorMessages((prevState) => {
        if (!prevState || !prevState.includes(message)) {
          return [...(prevState ?? []), message];
        }
        return prevState;
      });
    },
    [setErrorMessages]
  );

  const clearErrorMessage = (idxToRemove) => {
    if (errorMessages && errorMessages.length > idxToRemove) {
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
      } else if (url.hostname === 'develop.door43.org') {
        setServerInfo(DCS_SERVERS['dev']);
      } else {
        setServerInfo(DCS_SERVERS['qa']);
      }
    };

    const getUrlInfo = async () => {
      let urlParts = url.pathname.replace(/^\/(.*)\/*$/, '$1').split('/');
      let info = {
        owner: '',
        repo: '',
        lang: '',
        ref: '',
        hash: '',
        hashParts: [],
      }
      if (urlParts.length > 1) {
        urlParts = url.pathname
          .replace(/^\/(u\/){0,1}/, '')
          .replace(/\/+$/, '')
          .replace(/\/preview\//, '/')
          .replace(/\/(branch|tag)\//, '/')
          .split('/');
        info = {
          owner: urlParts[0] || '',
          repo: urlParts[1] || '',
          lang: urlParts[1]?.includes('_') ? urlParts[1].split('_')[0] : '',
          ref: urlParts[2] === 'preview' ? urlParts.slice(3).join('/') : urlParts.slice(2).join('/'),
          hash: url.hash.replace('#', ''),
          hashParts: url.hash ? url.hash.replace('#', '').split('-') : [],
        };
      } else if (urlParts.length === 1 && urlParts[0] != 'u') {
        info.lang = urlParts[0];
      }

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

    const getOtherUrlParameters = () => {
      if (url.searchParams.get('token')) {
        setAuthToken(url.searchParams.get('token'));
      } else {
        setAuthToken(import.meta.env.VITE_DCS_READ_ONLY_TOKEN);
      }
      if (
        url.searchParams.get('rerender') === '1' ||
        url.searchParams.get('rerender') === 'true' ||
        url.searchParams.get('force-rerender') === '1' ||
        url.searchParams.get('force-rerender') === 'true' ||
        url.searchParams.get('force-render') === '1' ||
        url.searchParams.get('force-render') === 'true'
      ) {
        setRenderMessage("Rerender requested. Generating new copy, ignoring cache.");
      }
      if (
        url.searchParams.get('nocache') === '1' ||
        url.searchParams.get('nocache') === 'true' ||
        url.searchParams.get('no-cache') === '1' ||
        url.searchParams.get('no-cache') === 'true'
      ) {
        setNoCache(true);
      }
    };

    getServerInfo().catch((e) => setErrorMessage(e.message));
    getUrlInfo().catch((e) => setErrorMessage(e.message));
    getOtherUrlParameters();
  }, [setErrorMessage]);

  useEffect(() => {
    const fetchOwner = async () => {
      try {
        const o = await getOwner(`${serverInfo.baseUrl}/${API_PATH}/users`, urlInfo.owner, authToken)
        setOwner(o);
      } catch(err) {
        console.log(err.message);
      }
    };

    if (serverInfo?.baseUrl && urlInfo && urlInfo.owner && !owner) {
      fetchOwner();
    }
  }, [serverInfo, urlInfo, owner, authToken, setErrorMessage]);

  useEffect(() => {
    const fetchRepo = async () => {
      getRepo(`${serverInfo.baseUrl}/${API_PATH}/repos`, urlInfo.owner, urlInfo.repo, authToken)
        .then((r) => {
          setRepo(r)
          if (!owner) {
            setOwner(r.owner)
          }
        })
        .catch((err) => {
          console.log(err.message);
          setErrorMessage(<>Unable to to find <a href={`${serverInfo.baseUrl}/${API_PATH}/repos/${urlInfo.owner}/${urlInfo.repo}`} target="_blank" rel="noreferrer">this resource on DCS</a> via the repo API.</>);
        });
    };

    if (serverInfo?.baseUrl && urlInfo && urlInfo.owner && urlInfo.repo && !repo) {
      fetchRepo()
    }
  }, [serverInfo, urlInfo, authToken, repo, owner, setErrorMessage]);

  useEffect(() => {
    const fetchCatalogEntry = async () => {
      if( repo && (! repo.subject || ! repo.metadata_type)){
        setErrorMessage("This repository does not appear to be a valid resource that we can render.");
        setFetchingCatalogEntry(false);
        return;
      }
      const entry = await getCatalogEntry(`${serverInfo.baseUrl}/${API_PATH}/catalog`, urlInfo.owner, urlInfo.repo, urlInfo.ref || repo?.default_branch || "master", authToken);
      if (entry) {
        setCatalogEntry(entry);
        if (! repo) {
          setRepo(entry.repo);
        }
        if (! owner) {
          setOwner(entry.repo.owner)
        }
      } else {
        if (repo) {
          setErrorMessage(<>Unable to <a href={`${serverInfo.baseUrl}/${API_PATH}/catalog/${urlInfo.owner}/${urlInfo.repo}/${urlInfo.ref || repo?.default_branch || "master"}`} target="_blank" rel="noreferrer">get a valid catalog entry</a> for this resource.</>);
        }
      }
      setFetchingCatalogEntry(false);
    };

    if (!fetchingCatalogEntry && !errorMessages?.length &&  serverInfo?.baseUrl && urlInfo && urlInfo.owner && urlInfo.repo && !catalogEntry) {
      setFetchingCatalogEntry(true);
      fetchCatalogEntry();
    }
  }, [fetchingCatalogEntry, catalogEntry, repo, owner, errorMessages, serverInfo, urlInfo, authToken, setErrorMessage]);

  useEffect(() => {
    const fetchCachedBook = async () => {
      let b = bookId || "default";
      if (urlInfo.hashParts?.[0] && urlInfo.hashParts[0].toLowerCase() in BibleBookData) {
        b = urlInfo.hashParts[0].toLowerCase()
      }
      const response = await fetch(`/.netlify/functions/get-cached-url?owner=${urlInfo.owner}&repo=${urlInfo.repo}&ref=${urlInfo.ref || repo?.default_branch || 'master'}&bookId=${b}`, {
        cache: 'default',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (!response.ok && catalogEntry) {
        setCachedBook({});
        return;
      }
      const url = await response.text();
      const cb = await downloadCachedBook(url);
      setCachedBook(cb || {}); // set to {} if null so we know we tried to fetch
      setCachedHtmlSections(cb?.htmlSections);
      setFetchingCachedBook(false);
    };

    if (renderMessage || noCache) {
      if (!cachedBook) {
        setCachedBook({});
      }
    } else if (!cachedBook && urlInfo && urlInfo.owner && urlInfo.repo && catalogEntry) {
      fetchCachedBook();
    }
  }, [urlInfo, catalogEntry, repo, bookId, cachedBook, fetchingCachedBook, noCache, renderMessage, authToken]);

  useEffect(() => {
    if (renderMessage || ! cachedBook) {
      return; // just waiting for cache to be checked. Will be {} (true) if checked but not there.
    }
    if (! Object.keys(cachedBook).length) {
      console.log("No cached copy of this resource/book, so rendering first time.");
      return;
    }
    if (! catalogEntry) {
      return; // Just waiting for catalog entry to be fetched
    }
    if (cachedBook.catalogEntry.commit_sha !== catalogEntry.commit_sha) {
      console.log(`The cached copy's catalog entry's sha and the newly fetched catalog entry sha do not match! Cached: ${cachedBook.catalogEntry.commit_sha}, New: ${catalogEntry.commit_sha}. Rendering new.`);
      setRenderMessage(`You are viewing a previous rendering (${cachedBook.catalogEntry.branch_or_tag_name != catalogEntry.branch_or_tag_name ? cachedBook.catalogEntry.branch_or_tag_name : cachedBook.catalogEntry.commit_sha.substring(0, 8)}). Please wait while it is updated...`);
      return;
    }
    if (cachedBook.preview_version !== APP_VERSION ) {
      console.log(`The cached copy's preview app version and the current version do not match! Cached ver: ${cachedBook.preview_version}, Current ver: ${APP_VERSION}. Rendering new.`);
      setRenderMessage(`You are viewing a previous rendering made with a previous version of this app (v${cachedBook.preview_version}). Please wait while it is updated to use v${APP_VERSION}...`);
      return;
    }
    if (Object.keys(cachedBook.builtWith).length !== builtWith.length) {
      console.log(`The number of resources used to build the cached copy and this one do not match: Cached: ${Object.keys(cachedBook.builtWith).length}, New: ${builtWith.length}.`);
      return;
    }

    for (let entry of (builtWith || [])) {
      if (!(entry.full_name in cachedBook.builtWith) || cachedBook.builtWith[entry.full_name] !== entry.commit_sha) {
        console.log(`Commit SHA for ${entry.full_name} used to build the cached copy is not the same as the current one to be used. Cached: ${cachedBook.builtWith[entry.full_name]}, New: ${entry.commit_sha}. Rendering new.`);
        setRenderMessage(`The dependency for rendering this resource, ${entry.full_name}, has been updated on DCS. Please wait while it is updated...`)
        return;
      }
    }    
    console.log("All seems to be the same as the cached copy and what would be used to render the new copy. Using cached copy.")
    setHtmlSections(cachedBook.htmlSections);
  }, [cachedBook, catalogEntry, builtWith, renderMessage, setRenderMessage, setHtmlSections]);

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
              // case 'TSV OBS Translation Notes':
              // setResourceComponent(() => RcObsTranslationNotes)
              // return;
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
    const sendCachedBook = async () => {
      if (!bookId || bookId === 'gen' || urlInfo.hashParts?.[0] !== bookId || supportedBooks?.[0] === bookId) {
        uploadCachedBook(urlInfo.owner, urlInfo.repo, catalogEntry.branch_or_tag_name, 'default', APP_VERSION, catalogEntry, builtWith, htmlSections);
      }
      if (bookId) {
        uploadCachedBook(urlInfo.owner, urlInfo.repo, catalogEntry.branch_or_tag_name, bookId, APP_VERSION, catalogEntry, builtWith, htmlSections);
      }
    };

    if (!noCache && htmlSections.body != '' && (JSON.stringify(htmlSections) !== JSON.stringify(cachedBook?.htmlSections) || renderMessage)) {
      sendCachedBook().catch((e) => console.log(e.message));
    }
  }, [htmlSections, catalogEntry, cachedBook, bookId, urlInfo, noCache, builtWith, supportedBooks]);

  // create the value for the context provider
  const context = {
    state: {
      urlInfo,
      catalogEntry,
      bookId,
      bookTitle,
      statusMessage,
      errorMessages,
      repo,
      owner,
      ResourceComponent,
      htmlSections,
      canChangeColumns,
      serverInfo,
      isOpenPrint,
      printOptions,
      documentReady,
      documentAnchor,
      printPreviewStatus,
      printPreviewPercentDone,
      authToken,
      cachedBook,
      cachedHtmlSections,
      supportedBooks,
      builtWith,
      renderMessage,
    },
    actions: {
      onPrintClick,
      setStatusMessage,
      setErrorMessage,
      clearErrorMessage,
      setHtmlSections,
      setCanChangeColumns,
      setIsOpenPrint,
      setPrintOptions,
      setDocumentReady,
      setDocumentAnchor,
      setPrintPreviewStatus,
      setPrintPreviewPercentDone,
      setBookId,
      setBookTitle,
      setSupportedBooks,
      setBuiltWith,
      setRenderMessage,
    },
  };

  return <AppContext.Provider value={context}>{children}</AppContext.Provider>;
}

AppContextProvider.propTypes = {
  /** Children to render inside of Provider */
  children: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.node), PropTypes.node]).isRequired,
};
