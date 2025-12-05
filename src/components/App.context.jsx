// React imports
import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { BibleBookData } from '@common/books';
import { uploadCachedBook } from '@helpers/books';

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
import RcStudyQuestions from '@components/RcStudyQuestions';
import RcTranslationWords from '@components/RcTranslationWords';
import RcObsStudyNotes from '@components/RcObsStudyNotes';
import RcObsStudyQuestions from '@components/RcObsStudyQuestions';
import RcObsTranslationNotes from '@components/RcObsTranslationNotes';
import RcObsTranslationQuestions from '@components/RcObsTranslationQuestions';
import TsBible from '@components/TsBible';
import { getMetadataTypeFromRepoName, getSubjectFromRepoName } from '@helpers/dcsApi';

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
  const [bookTitle, setBookTitle] = useState('');
  const [supportedBooks, setSupportedBooks] = useState([]);
  const [htmlSections, setHtmlSections] = useState({ css: { web: '', print: '' }, cover: '', copyright: '', toc: '', body: '' });
  const [pagedJsReadyHtml, setPagedJsReadyHtml] = useState('');
  const [canChangeColumns, setCanChangeColumns] = useState(false);
  const [isOpenPrint, setIsOpenPrint] = useState(false);
  const [printOptions, setPrintOptions] = useState({});
  const [documentReady, setDocumentReady] = useState(false);
  const [navAnchor, setNavAnchor] = useState('');
  const [newUrlHash, setNewUrlHash] = useState('');
  const [printPreviewStatus, setPrintPreviewStatus] = useState('not started');
  const [printPreviewPercentDone, setPrintPreviewPercentDone] = useState(0);
  const [authToken, setAuthToken] = useState();
  const [builtWith, setBuiltWith] = useState([]);
  const [cachedBook, setCachedBook] = useState();
  const [cachedHtmlSections, setCachedHtmlSections] = useState();
  const [fetchingCachedBook, setFetchingCachedBook] = useState(false);
  const [renderMessage, setRenderMessage] = useState(''); // Gives reason for rendering, also a flag that a new render is needed
  const [renderNewCopy, setRenderNewCopy] = useState(false);
  const [noCache, setNoCache] = useState(false);
  const [fetchingCatalogEntry, setFetchingCatalogEntry] = useState(false);
  const [fetchingRepo, setFetchingRepo] = useState(false);
  const [renderOptions, setRenderOptions] = useState({});
  const [lastBookId, setLastBookId] = useState('');
  const [settingsComponent, setSettingsComponent] = useState();
  const [extraDownloadButtons, setExtraDownloadButtons] = useState([]);
  const [view, setView] = useState('web');
  const [books, setBooks] = useState([]);
  const [expandedBooks, setExpandedBooks] = useState([]);
  const [cachedFileSuffix, setCachedFileSuffix] = useState('');
  const [isDefaultBook, setIsDefaultBook] = useState(false);
  const [availableRefsCurrent, setAvailableRefsCurrent] = useState({});
  const [fetchingAvailableRefs, setFetchingAvailableRefs] = useState(false);

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

    // Get Server Info
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

    // Get URL Info
    let urlParts = url.pathname.replace(/^\/(.*)\/*$/, '$1').split('/');
    let info = {
      owner: '',
      repo: '',
      lang: '',
      ref: '',
      hash: '',
      hashParts: [],
    };
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
        hash: url.hash.replace('#', '').toLowerCase(),
        hashParts: url.hash ? url.hash.replace(/^#/, '').toLowerCase().split(/--/)[0].split('-') : [], // Used for Bible Book Reference Navigation
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
    setNavAnchor(info.hash);
    if (!info.repo) {
      setStatusMessage('');
    }

    // Get Book(s) Info
    let _lastBookId = '';
    if (info.owner && info.repo) {
      const lastBookIdCookie = document.cookie.split('; ').find((row) => row.startsWith(`${info.owner}-${info.repo}-lastBookId`));
      console.log('lastBookIdCookie:', lastBookIdCookie);
      if (lastBookIdCookie) {
        _lastBookId = lastBookIdCookie.split('=')[1];
      }
    }

    let _books = [];
    const _expandedBooks = [];
    if (url.searchParams.get('book')) {
      _books = url.searchParams.getAll('book').flatMap((book) => book.split(',').map((b) => b.trim().toLowerCase()));
    }
    const hashBookId = url.hash?.replace('#', '').toLowerCase().split('-')[0];
    if (hashBookId && hashBookId in BibleBookData && !_books.includes(hashBookId)) {
      _books.push(hashBookId);
    }
    if (_lastBookId && !_books.length) {
      _books = _lastBookId.split('-');
    }
    console.log('BOOKS AFTER LAST BOOK', _books);

    for (let book of _books) {
      if (['nt', 'new', 'ot', 'old', 'all'].includes(book)) {
        if (book === 'ot') {
          book = 'old';
        } else if (book === 'nt') {
          book = 'new';
        }
        if (book == 'all') {
          _expandedBooks.push(...Object.keys(BibleBookData).filter((book) => !_expandedBooks.includes(book)));
        } else {
          _expandedBooks.push(
            ...Object.keys(BibleBookData)
              .filter((key) => BibleBookData[key].testament === book)
              .sort((a, b) => BibleBookData[a].usfm - BibleBookData[b].usfm)
              .filter((book) => !_expandedBooks.includes(book))
          );
        }
      } else if (book in BibleBookData && !_expandedBooks.includes(book)) {
        _expandedBooks.push(book);
      }
    }
    console.log('BOOKS:', _books);
    console.log('EXPANDED BOOKS:', _expandedBooks);
    setBooks(_books);
    setExpandedBooks(_expandedBooks);
    setLastBookId(_books.join('-') || _lastBookId);

    // Get Auth Token
    if (url.searchParams.get('token')) {
      setAuthToken(url.searchParams.get('token'));
    } else {
      // Fetch token from server config
      fetch('/api/config')
        .then(res => res.json())
        .then(config => {
          if (config.dcsReadOnlyToken) {
            setAuthToken(config.dcsReadOnlyToken);
          }
        })
        .catch(err => console.error('Failed to fetch config:', err));
    }
    if (
      url.searchParams.get('rerender') === '1' ||
      url.searchParams.get('rerender') === 'true' ||
      url.searchParams.get('force-rerender') === '1' ||
      url.searchParams.get('force-rerender') === 'true' ||
      url.searchParams.get('force-render') === '1' ||
      url.searchParams.get('force-render') === 'true'
    ) {
      setRenderMessage('Rerender requested. Generating new copy, ignoring cache.');
      setRenderNewCopy(true);
    }
    if (
      url.searchParams.get('nocache') === '1' ||
      url.searchParams.get('nocache') === 'true' ||
      url.searchParams.get('no-cache') === '1' ||
      url.searchParams.get('no-cache') === 'true'
    ) {
      setNoCache(true);
    }

    // Check if editor mode
    if (url.searchParams.get('editor') === '1' || url.searchParams.get('edit') === 'true') {
      setRenderOptions((prevState) => ({ ...prevState, editorMode: true }));
      setNoCache(true);
    }

    // Get chapters to render
    if (url.searchParams.get('chapters')) {
      const chaptersOrigStr = url.searchParams.get('chapters');
      const chapterList = chaptersOrigStr.split(',').map((chapter) => chapter.trim());
      const chapters = [];
      chapterList.forEach((chapter) => {
        if (chapter.includes('-')) {
          const [start, end] = chapter.split('-').map((num) => num.trim());
          if (!isNaN(parseInt(start)) && !isNaN(parseInt(end))) {
            let parsedStart = Math.abs(parseInt(start));
            if (parsedStart < 1) {
              parsedStart = 1;
            }
            const parsedEnd = Math.abs(parseInt(end));
            for (let i = parsedStart; i <= parsedEnd; i++) {
              chapters.push(i.toString());
            }
          }
        } else {
          const chapterNum = parseInt(chapter.trim());
          if (!isNaN(chapterNum) && chapterNum > 0) {
            chapters.push(chapter);
          }
        }
      });
      setRenderOptions((prevState) => ({ ...prevState, chaptersOrigStr: chaptersOrigStr, chapters: chapters }));
      setNoCache(true);
    }
  }, [setErrorMessage]);

  useEffect(() => {
    const setLastBookIdCookie = () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 14); // 2 weeks from now
      document.cookie = `${urlInfo.owner}-${urlInfo.repo}-lastBookId=${lastBookId}; expires=${expirationDate.toUTCString()}; path=/u/${urlInfo.owner}/${urlInfo.repo}`;
    };
    if (urlInfo && urlInfo.owner && urlInfo.repo && lastBookId && lastBookId != 'default' && !lastBookId.includes('-')) {
      setLastBookIdCookie();
    }
  }, [lastBookId, urlInfo]);

  const fetchAvailableRefsForCurrentRepo = useCallback(
    async (refType) => {
      if (fetchingAvailableRefs || !serverInfo?.baseUrl || !urlInfo?.owner || !urlInfo?.repo) return;
      if (availableRefsCurrent[refType]?.length) return;
      setFetchingAvailableRefs(true);
      try {
        const path = refType === 'tag' ? 'tags' : 'branches';
        const res = await fetch(`${serverInfo.baseUrl}/${API_PATH}/repos/${urlInfo.owner}/${urlInfo.repo}/${path}/`, {
          cache: 'default',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.map ? data : [];
        const values = (refType === 'tag' ? list.map((t) => t.name) : list.map((b) => b.name)).filter(Boolean);
        setAvailableRefsCurrent((prev) => ({ ...prev, [refType]: values }));
      } catch (e) {
        console.log('Error fetching refs:', e.message);
      } finally {
        setFetchingAvailableRefs(false);
      }
    },
    [serverInfo, urlInfo, authToken, fetchingAvailableRefs, availableRefsCurrent]
  );

  useEffect(() => {
    const fetchOwner = async () => {
      try {
        const o = await getOwner(`${serverInfo.baseUrl}/${API_PATH}`, urlInfo.owner, authToken);
        setOwner(o);
      } catch (err) {
        console.log(err.message);
      }
    };

    if (serverInfo?.baseUrl && urlInfo && urlInfo.owner && !owner) {
      fetchOwner();
    }
  }, [serverInfo, urlInfo, owner, authToken, setErrorMessage]);

  useEffect(() => {
    const fetchRepo = async () => {
      getRepo(`${serverInfo.baseUrl}/${API_PATH}`, urlInfo.owner, urlInfo.repo, authToken)
        .then((r) => {
          setRepo(r);
          if (!owner) {
            setOwner(r.owner);
          }
        })
        .catch((err) => {
          console.log(err.message);
          setErrorMessage(
            <>
              Unable to find{' '}
              <a href={`${serverInfo.baseUrl}/${API_PATH}/repos/${urlInfo.owner}/${urlInfo.repo}`} target="_blank" rel="noreferrer">
                this resource on DCS
              </a>{' '}
              via the repo API.
            </>
          );
        })
        .finally(() => setFetchingRepo(false));
    };

    if (!fetchingRepo && !errorMessages?.length && serverInfo?.baseUrl && urlInfo && urlInfo.owner && urlInfo.repo && !repo) {
      setFetchingRepo(true);
      fetchRepo();
    }
  }, [serverInfo, urlInfo, authToken, fetchingRepo, repo, owner, errorMessages, setErrorMessage]);

  useEffect(() => {
    const fetchCatalogEntry = async () => {
      if (repo && (!repo.subject || !repo.metadata_type)) {
        setErrorMessage('This repository does not appear to be a valid resource that we can render.');
        setFetchingCatalogEntry(false);
        return;
      }
      const entry = await getCatalogEntry(`${serverInfo.baseUrl}/${API_PATH}`, urlInfo.owner, urlInfo.repo, urlInfo.ref || repo?.default_branch || 'master', authToken);
      if (entry) {
        setCatalogEntry(entry);
        if (!repo) {
          setRepo(entry.repo);
        }
        if (!owner) {
          setOwner(entry.repo.owner);
        }
      } else {
        if (repo) {
          setErrorMessage(
            <>
              Unable to{' '}
              <a
                href={`${serverInfo.baseUrl}/${API_PATH}/catalog/${urlInfo.owner}/${urlInfo.repo}/${urlInfo.ref || repo?.default_branch || 'master'}`}
                target="_blank"
                rel="noreferrer"
              >
                get a valid catalog entry
              </a>{' '}
              for this resource.
            </>
          );
        }
      }
      setFetchingCatalogEntry(false);
    };

    if (!fetchingCatalogEntry && !errorMessages?.length && serverInfo?.baseUrl && urlInfo && urlInfo.owner && urlInfo.repo && !catalogEntry) {
      setFetchingCatalogEntry(true);
      fetchCatalogEntry();
    }
  }, [fetchingCatalogEntry, catalogEntry, repo, owner, errorMessages, serverInfo, urlInfo, authToken, setErrorMessage]);

  useEffect(() => {
    const fetchCachedBook = async () => {
      // Try the fast path first: direct server route
      const fastPathUrl = `/api/cached-page/${urlInfo.owner}/${urlInfo.repo}/${urlInfo.ref || repo?.default_branch || 'master'}?book=${cachedFileSuffix}`;
      
      try {
        const fastResponse = await fetch(fastPathUrl, {
          cache: 'default',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        
        if (fastResponse.ok) {
          const result = await fastResponse.json();
          if (result.cached && result.data) {
            console.log('✅ Using cached version from fast path');
            setCachedBook(result.data);
            setCachedHtmlSections(result.data?.htmlSections);
            setFetchingCachedBook(false);
            return;
          }
        } else if (fastResponse.status === 404) {
          // File doesn't exist - set empty object to indicate we tried to fetch
          console.log('No cached version available from fast path');
          setCachedBook({});
          setCachedHtmlSections(null);
          setFetchingCachedBook(false);
          return;
        }
      } catch (e) {
        console.log('Fast path not available, falling back to API:', e.message);
      }

      // Fallback to original API route
      const response = await fetch(
        `/api/get-cached-html?owner=${urlInfo.owner}&repo=${urlInfo.repo}&ref=${urlInfo.ref || repo?.default_branch || 'master'}&bookId=${cachedFileSuffix}`,
        {
          cache: 'default',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      if (!response.ok) {
        console.log('No cached version available from fallback API');
        setCachedBook({});
        setCachedHtmlSections(null);
        setFetchingCachedBook(false);
        return;
      }
      try {
        const cb = await response.json();
        setCachedBook(cb || {}); // set to {} if null so we know we tried to fetch
        setCachedHtmlSections(cb?.htmlSections || null);
      } catch (e) {
        console.error(`Error parsing cached book JSON:`, e);
        setCachedBook({});
        setCachedHtmlSections(null);
      }
      setFetchingCachedBook(false);
    };

    if (cachedFileSuffix) {
      if (renderNewCopy || noCache) {
        if (!cachedBook) {
          setCachedBook({});
          setRenderNewCopy(true);
        }
      } else if (!fetchingCachedBook && !cachedBook) {
        setFetchingCachedBook(true);
        fetchCachedBook();
      }
    }
  }, [urlInfo, books, renderNewCopy, cachedFileSuffix, catalogEntry, repo?.default_branch, cachedBook, fetchingCachedBook, noCache, renderMessage, authToken]);

  useEffect(() => {
    const determineIfRenderingNewCopyNecessary = () => {
      if (!Object.keys(cachedBook).length) {
        console.log('No cached copy of this resource/book, so rendering first time.');
        setRenderNewCopy(true);
        return;
      }
      if (cachedBook.catalogEntry.commit_sha !== catalogEntry.commit_sha) {
        console.log(
          `The cached copy's catalog entry's sha and the newly fetched catalog entry sha do not match! Cached: ${cachedBook.catalogEntry.commit_sha}, New: ${catalogEntry.commit_sha}. Rendering new.`
        );
        setRenderMessage(
          `You are viewing a previous rendering (${
            cachedBook.catalogEntry.branch_or_tag_name != catalogEntry.branch_or_tag_name
              ? cachedBook.catalogEntry.branch_or_tag_name
              : cachedBook.catalogEntry.commit_sha.substring(0, 8)
          }). Please wait while it is updated...`
        );
        setRenderNewCopy(true);
        return;
      }
      if (cachedBook.preview_version !== APP_VERSION) {
        console.log(
          `The cached copy's preview app version and the current version do not match! Cached ver: ${cachedBook.preview_version}, Current ver: ${APP_VERSION}. Rendering new.`
        );
        setRenderMessage(
          `You are viewing a previous rendering made with a previous version of this app (v${cachedBook.preview_version}). Please wait while it is updated with v${APP_VERSION}...`
        );
        setRenderNewCopy(true);
        return;
      }
      if (Object.keys(cachedBook.builtWith).length !== builtWith.length) {
        console.log(
          `The number of resources used to build the cached copy and this one do not match: Cached: ${Object.keys(cachedBook.builtWith).length}, New: ${builtWith.length}.`
        );
        setRenderMessage(`The rendering process for resource has changed. Please wait while it is updated...`);
        setRenderNewCopy(true);
        return;
      }

      for (let entry of builtWith) {
        if (!(entry.full_name in cachedBook.builtWith) || cachedBook.builtWith[entry.full_name] !== entry.commit_sha) {
          console.log(
            `Commit SHA for ${entry.full_name} used to build the cached copy is not the same as the current one to be used. Cached: ${
              cachedBook.builtWith[entry.full_name]
            }, New: ${entry.commit_sha}. Rendering new.`
          );
          setRenderMessage(`The dependency for rendering this resource, ${entry.full_name}, has been updated on DCS. Please wait while it is updated...`);
          setRenderNewCopy(true);
          return;
        }
      }
      console.log('All seems to be the same as the cached copy and what would be used to render the new copy. Using cached copy.');
      setHtmlSections(cachedBook.htmlSections);
    };

    if (catalogEntry && cachedBook && !renderNewCopy && builtWith.length) {
      determineIfRenderingNewCopyNecessary();
    }
  }, [cachedBook, catalogEntry, renderNewCopy, builtWith, renderMessage, setRenderMessage, setHtmlSections]);

  useEffect(() => {
    if (cachedFileSuffix && cachedFileSuffix != 'default') {
      const url = new URL(window.location);
      url.searchParams.delete('book');
      cachedFileSuffix.split('-').forEach((b) => url.searchParams.append('book', b));
      window.history.replaceState(null, '', url);
    }
  }, [cachedFileSuffix]);

  useEffect(() => {
    let metadataType = ''; // default
    let subject = '';
    let flavorType = '';
    let flavor = '';
    if (!catalogEntry) {
      if (urlInfo?.repo) {
        metadataType = getMetadataTypeFromRepoName(urlInfo.repo);
        subject = getSubjectFromRepoName(urlInfo.repo);
        if (metadataType == 'sb' && subject) {
          if (subject == 'Bible' || subject == 'Aligned Bible') {
            flavorType = 'scripture';
            flavorType = 'textTranslation';
          } else {
            flavorType = 'gloss';
            if (subject == 'Open Bible Stories') {
              flavor = 'textStories';
            }
          }
        }
      }
    } else {
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
          setResourceComponent(null);
          return;
        }
      }
      metadataType = catalogEntry.metadata_type;
      subject = catalogEntry.subject;
      flavorType = catalogEntry.flavor_type;
      flavor = catalogEntry.flavor;
    }
    if (metadataType && subject) {
      if (!['rc', 'sb', 'ts', 'tc'].includes(metadataType)) {
        setErrorMessage(`Not a valid repository that can be convert.`);
        return;
      }
      let usesBooks = false;
      switch (metadataType) {
        case 'rc':
          switch (subject) {
            case 'Aligned Bible':
            case 'Bible':
            case 'Greek New Testament':
            case 'Hebrew Old Testament':
              setResourceComponent(() => Bible);
              usesBooks = true;
              break;
            case 'Open Bible Stories':
              setResourceComponent(() => OpenBibleStories);
              break;
            case 'Translation Academy':
              setResourceComponent(() => RcTranslationAcademy);
              break;
            case 'TSV Study Questions':
              setResourceComponent(() => RcStudyQuestions);
              usesBooks = true;
              break;
            case 'TSV Translation Notes':
              setResourceComponent(() => RcTranslationNotes);
              usesBooks = true;
              break;
            case 'TSV Translation Questions':
              setResourceComponent(() => RcTranslationQuestions);
              usesBooks = true;
              break;
            case 'Translation Words':
              setResourceComponent(() => RcTranslationWords);
              break;
            case 'TSV OBS Study Notes':
              setResourceComponent(() => RcObsStudyNotes);
              break;
            case 'TSV OBS Study Questions':
              setResourceComponent(() => RcObsStudyQuestions);
              break;
            case 'TSV OBS Translation Notes':
              setResourceComponent(() => RcObsTranslationNotes);
              break;
            case 'TSV OBS Translation Questions':
              setResourceComponent(() => RcObsTranslationQuestions);
              break;
            default:
              if (catalogEntry) {
                setErrorMessage(`Conversion of \`${subject}\` resources is currently not supported.`);
              }
          }
          break;
        case 'sb':
          switch (flavorType) {
            case 'scripture':
              switch (flavor) {
                case 'textTranslation':
                  setResourceComponent(() => Bible);
                  usesBooks = true;
                  break;
                default:
                  setErrorMessage(`Conversion of SB flavor \`${flavor}\` is not currently supported.`);
              }
              break;
            case 'gloss':
              switch (catalogEntry.flavor) {
                case 'textStories':
                  setResourceComponent(() => OpenBibleStories);
                  break;
              }
              break;
            default:
              if (catalogEntry) {
                setErrorMessage(`Conversion of SB flavor type \`${flavorType}\` is not currently supported.`);
              }
          }
          break;
        case 'ts':
          switch (subject) {
            case 'Open Bible Stories':
              setResourceComponent(() => OpenBibleStories);
              break;
            case 'Bible':
              setResourceComponent(() => TsBible);
              usesBooks = true;
              break;
            default:
              if (catalogEntry) {
                setErrorMessage('Conversion of translationStudio repositories is currently not supported.');
              }
          }
          break;
        case 'tc':
          switch (subject) {
            case 'Aligned Bible':
            case 'Bible':
              setResourceComponent(() => Bible);
              usesBooks = true;
              break;
            default:
              if (catalogEntry) {
                setErrorMessage(`Conversion of translationCore \`${subject}\` repositories is currently not supported.`);
              }
          }
          break;
      }
      let _cachedFileSuffix = 'default';
      if (usesBooks) {
        _cachedFileSuffix = books.join('-');
        if (!_cachedFileSuffix) {
          for (const ingredient of catalogEntry?.ingredients || []) {
            if (ingredient.identifier in BibleBookData) {
              setBooks([ingredient.identifier]);
              setExpandedBooks([ingredient.identifier]);
              _cachedFileSuffix = ingredient.identifier;
              break;
            }
          }
        }
        setCachedFileSuffix(_cachedFileSuffix);
      }
      setCachedFileSuffix(_cachedFileSuffix);
      if (_cachedFileSuffix === 'default') {
        setIsDefaultBook(true);
      } else {
        setIsDefaultBook(false);
      }
    }
  }, [urlInfo, catalogEntry, books, setErrorMessage]);

  useEffect(() => {
    const handleDownloadHtml = () => {
      const fileName = `${catalogEntry.repo.name}_${catalogEntry.branch_or_tag_name}${books.length ? `_${books.join('-')}` : ''}.html`;
      const fileContent = pagedJsReadyHtml || '';
      const blob = new Blob([fileContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    };

    if (catalogEntry && pagedJsReadyHtml) {
      const noHtmlButtons = extraDownloadButtons.filter((buttonData) => buttonData.label !== 'HTML');
      setExtraDownloadButtons([
        ...noHtmlButtons,
        {
          label: 'HTML',
          tooltip: 'Download the HTML for printing',
          onClick: handleDownloadHtml,
        },
      ]);
    }
  }, [catalogEntry, books, pagedJsReadyHtml, setExtraDownloadButtons]);

  useEffect(() => {
    const sendCachedBook = async () => {
      uploadCachedBook(urlInfo.owner, urlInfo.repo, catalogEntry.branch_or_tag_name, cachedFileSuffix, APP_VERSION, catalogEntry, builtWith, htmlSections);
      if (isDefaultBook && cachedFileSuffix != 'default') {
        uploadCachedBook(urlInfo.owner, urlInfo.repo, catalogEntry.branch_or_tag_name, 'default', APP_VERSION, catalogEntry, builtWith, htmlSections);
      }
    };

    if (
      cachedFileSuffix &&
      !noCache &&
      !Object.keys(renderOptions).length &&
      htmlSections.body != '' &&
      (JSON.stringify(htmlSections) !== JSON.stringify(cachedBook?.htmlSections) || renderMessage)
    ) {
      sendCachedBook().catch((e) => console.log(e.message));
    }
  }, [htmlSections, cachedFileSuffix, catalogEntry, renderOptions, renderMessage, cachedBook, urlInfo, noCache, builtWith, supportedBooks, isDefaultBook]);

  // create the value for the context provider
  const context = {
    state: {
      urlInfo,
      catalogEntry,
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
      navAnchor,
      newUrlHash,
      printPreviewStatus,
      printPreviewPercentDone,
      authToken,
      cachedBook,
      cachedHtmlSections,
      supportedBooks,
      builtWith,
      renderMessage,
      renderNewCopy,
      pagedJsReadyHtml,
      renderOptions,
      lastBookId,
      settingsComponent,
      extraDownloadButtons,
      view,
      books,
      expandedBooks,
      cachedFileSuffix,
      availableRefsCurrent,
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
      setNavAnchor,
      setNewUrlHash,
      setPrintPreviewStatus,
      setPrintPreviewPercentDone,
      setBookTitle,
      setSupportedBooks,
      setBuiltWith,
      setRenderMessage,
      setPagedJsReadyHtml,
      setRenderOptions,
      setLastBookId,
      setSettingsComponent,
      setExtraDownloadButtons,
      setView,
      setNoCache,
      setBooks,
      setExpandedBooks,
      setCachedFileSuffix,
      setIsDefaultBook,
      fetchAvailableRefsForCurrentRepo,
    },
  };

  return <AppContext.Provider value={context}>{children}</AppContext.Provider>;
}

AppContextProvider.propTypes = {
  /** Children to render inside of Provider */
  children: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.node), PropTypes.node]).isRequired,
};
