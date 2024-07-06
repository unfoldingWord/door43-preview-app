// React imports
import { useState, useEffect, useContext } from 'react';

// USFM parsing library
import usfm from 'usfm-js';

// Custom hooks
import useUsfmPreviewRenderer from '@hooks/useUsfmPreviewRender';

// Bible reference component
import BibleReference from 'bible-reference-rcl';

// Helper functions and constants
import { getLtrPreviewStyle, getRtlPreviewStyle } from '@helpers/previewStyling.js';
import { getSupportedBooks } from '@helpers/books';
import { getRepoContentsContent, getRepoGitTrees } from '@helpers/dcsApi';
import { generateCoverPage, generateTocHtml, generateCopyrightAndLicenseHTML } from '@helpers/html';

// Context
import { AppContext } from '@contexts/App.context';

// Bible reference hook and data
import { useBibleReference } from 'bible-reference-rcl';
import { BibleBookData } from '@common/books';

const webCss = `
h1 {
  column-span: all;
}

.new-page {
  break-after: page;
  column-span: all;
}

.header-link {
  text-decoration: none;
  color: inherit;
}
`;

const printCss = '';

export default function Bible() {
  const {
    state: { urlInfo, catalogEntry, navAnchor, authToken, bookId, bookTitle, supportedBooks, builtWith, htmlSections, errorMessages, renderOptions },
    actions: { setBookId, setBookTitle, setBuiltWith, setSupportedBooks, setStatusMessage, setErrorMessage, setHtmlSections, setNavAnchor, setCanChangeColumns, setPrintOptions, setNavComponent },
  } = useContext(AppContext);

  const [usfmText, setUsfmText] = useState();

  const renderFlags = {
    showWordAtts: false,
    showTitles: true,
    showHeadings: true,
    showIntroductions: true,
    showFootnotes: true,
    showXrefs: false,
    showParaStyles: true,
    showCharacterMarkup: false,
    showChapterLabels: true,
    showVersesLabels: true,
  };

  const onBibleReferenceChange = (b, c, v) => {
    if (b != (bookId || urlInfo.hashParts[0] || 'gen')) {
      window.location.hash = b;
      window.location.reload();
    } else if (setNavAnchor) {
      let anchorParts = [b];
      if (c != '1' || v != '1') {
        anchorParts.push(c);
      }
      if (v != '1') {
        anchorParts.push(v);
      }
      setNavAnchor(anchorParts.join('-'));
    }
  };

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: bookId || urlInfo.hashParts[0] || 'gen',
    initialChapter: urlInfo.hashParts[1] || '1',
    initialVerse: urlInfo.hashParts[2] || '1',
    onChange: onBibleReferenceChange,
  });

  const { renderedData, ready: htmlReady } = useUsfmPreviewRenderer({
    bookId,
    usfmText,
    renderFlags,
    renderStyles: catalogEntry?.language_direction === 'rtl' ? getRtlPreviewStyle() : getLtrPreviewStyle(),
    htmlRender: true,
    setErrorMessage,
  });

  useEffect(() => {
    if (catalogEntry) {
      setBuiltWith([catalogEntry])
      setNavComponent(<BibleReference status={bibleReferenceState} actions={bibleReferenceActions} />);
    }
  }, [catalogEntry, setBuiltWith])

  useEffect(() => {
    if (navAnchor && ! navAnchor.includes('--')) {
      const parts = navAnchor.split('-');
      if (bibleReferenceState.bookId != parts[0] || bibleReferenceState.chapter != parts[1] || bibleReferenceState.verse != parts[2]) {
        bibleReferenceActions.goToBookChapterVerse(parts[0], parts[1] || '1', parts[2] || '1');
      }
    }
  }, [navAnchor]);

  useEffect(() => {
    const setInitialBookIdAndSupportedBooks = async () => {
      if (!catalogEntry) {
        // setErrorMessage('No catalog entry for this resource found.');
        return;
      }

      let repoFileList = null;
      try {
        repoFileList = (await getRepoGitTrees(catalogEntry.repo.url, catalogEntry.branch_or_tag_name, authToken, true)).map((tree) => tree.path);
      } catch (e) {
        console.log(`Error calling getRepoGitTrees(${catalogEntry.repo.url}, ${catalogEntry.branch_or_tag_name}, true): `, e);
      }

      let sb = getSupportedBooks(catalogEntry, repoFileList);
      if (!sb.length) {
        setErrorMessage('There are no books in this resource to render.');
        return;
      }

      let _bookId = urlInfo.hashParts[0] || sb[0];
      if (!_bookId) {
        setErrorMessage('Unable to determine a book ID to render.');
        return;
      }
      const title = catalogEntry.ingredients.filter((ingredient) => ingredient.identifier == _bookId).map((ingredient) => ingredient.title)[0] || _bookId;
      setBookId(_bookId);
      setBookTitle(title);
      setStatusMessage(
        <>
          Preparing preview for {title}.
          <br />
          Please wait...
        </>
      );
      if (!sb.includes(_bookId)) {
        setErrorMessage(`This resource does not support the rendering of the book \`${_bookId}\`. Please choose another book to render.`);
        sb = [_bookId, ...sb];
      }

      setSupportedBooks(sb);
      bibleReferenceActions.applyBooksFilter(sb);

      setCanChangeColumns(true);
      setPrintOptions((prevState) => ({ ...prevState, columns: 2 }));
    };

    setInitialBookIdAndSupportedBooks();
  }, [urlInfo, catalogEntry, authToken, setBookId, setBookTitle, setCanChangeColumns, setErrorMessage, setPrintOptions, setStatusMessage, setSupportedBooks]);

  useEffect(() => {
    const fetchUsfmFileFromDCS = async () => {
      if (!(bookId in BibleBookData)) {
        setErrorMessage(`Invalid book: ${bookId}`);
        return;
      }

      let filePath = '';
      catalogEntry.ingredients.forEach((ingredient) => {
        if (ingredient.identifier == bookId) {
          filePath = ingredient.path.replace(/^\.\//, '');
        }
      });
      if (!filePath) {
        setErrorMessage(`Book \`${bookId}\` is not in repo's project list.`);
      }

      getRepoContentsContent(catalogEntry.repo.url, filePath, catalogEntry.commit_sha, authToken, false)
        .then((_usfmText) => {
          const usfmJSON = usfm.toJSON(_usfmText);
          for (let i = 0; i < usfmJSON?.headers?.length; ++i) {
            if (usfmJSON.headers[i].tag && (usfmJSON.headers[i].tag == 'h' || usfmJSON.headers[i].tag.startsWith('toc'))) {
              setBookTitle(usfmJSON.headers[i].content);
              break;
            }
          }
          setUsfmText(_usfmText);
        })
        .catch((e) => {
          console.log(`Error calling getRepoContentsContent(${catalogEntry.repo.url}, ${filePath}, ${catalogEntry.commit_sha}): `, e);
          setErrorMessage(`Unable to get content for book \`${bookId}\` from DCS`);
        });
    };

    if (! htmlSections?.body && catalogEntry && supportedBooks && bookId && supportedBooks.includes(bookId) && !errorMessages) {
      fetchUsfmFileFromDCS();
    }
  }, [htmlSections, supportedBooks, catalogEntry, bookId, authToken, errorMessages, setBookTitle, setErrorMessage]);

  useEffect(() => {
    const populateHtmlSections = async () => {
      const cover = generateCoverPage(catalogEntry, `<h3>${bookTitle}</h3>` + (renderOptions.chaptersOrigStr ? `<h4>Chapters: ${renderOptions.chaptersOrigStr}</h4>` : ''));
      const copyright = await generateCopyrightAndLicenseHTML(catalogEntry, builtWith, authToken);
      let body = renderedData.replaceAll(
        /<span id="chapter-(\d+)-verse-(\d+)"([^>]*)>(\d+)<\/span>/g,
        `<span id="nav-${bookId}-$1-$2"$3><a href="#nav-${bookId}-$1-$2" class="header-link">$4</a></span>`
      );
      body = body.replaceAll(
        /<span id="chapter-(\d+)"([^>]+)>([\d]+)<\/span>/gi,
        `<span id="nav-${bookId}-$1" data-toc-title="${bookTitle} $1"$2><a href="#nav-${bookId}-$1-1" class="header-link">$3</a></span>`
      );
      body = body.replaceAll(/<span([^>]+style="[^">]+#CCC[^">]+")/gi, `<span$1 class="footnote"`);
      const toc = generateTocHtml(body);

      // const footnotes = _html.match(/<span class="footnote">/g);
      // if (footnotes) {
      //   footnotes.forEach((footnote, index) => {
      //     const footnoteId = `footnote-${index}`;
      //     const anchor = `<a href="#${footnoteId}">${index + 1}.</a>`;
      //     body = body.replace(footnote, `${footnote}<span id="${footnoteId}">${anchor}</span>`);
      //   });
      // }

      body = `
        <div class="section bible-book" id="nav-${bookId}" data-toc-title="${bookTitle}">
          ${body}
        </div>
`;

      setHtmlSections((prevState) => ({
        ...prevState,
        css: {
          web: webCss,
          print: printCss,
        },
        toc,
        cover,
        copyright,
        body,
      }));
      setStatusMessage('');
    };

    if (renderedData && htmlReady && builtWith?.length) {
      populateHtmlSections();
    }

  }, [renderedData, htmlReady, bookId, bookTitle, authToken, builtWith, catalogEntry, setHtmlSections, setStatusMessage]);

  return <></>;
}
