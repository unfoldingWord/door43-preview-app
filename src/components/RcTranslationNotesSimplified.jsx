// React imports
import { useEffect, useContext } from 'react';

// Bible reference imports
import BibleReference, { useBibleReference } from 'bible-reference-rcl';

// Helper imports
import { getSupportedBooks } from '@helpers/books';
import { getRepoGitTrees } from '@helpers/dcsApi';

// Hook imports
import useTranslationNotesHtml from '@hooks/useTranslationNotesHtml';

// Context imports
import { AppContext } from '@components/App.context';
import { APP_VERSION } from '@common/constants';

export default function RcTranslationNotes() {
  const {
    state: { urlInfo, catalogEntry, expandedBooks, bookTitle, navAnchor, authToken, renderOptions, supportedBooks, errorMessages, renderNewCopy },
    actions: { setBookTitle, setSupportedBooks, setStatusMessage, setErrorMessage, setHtmlSections, setNavAnchor, setCanChangeColumns, setBuiltWith, setIsDefaultBook },
  } = useContext(AppContext);

  // Single hook to handle all HTML generation
  const { htmlData, loading, error } = useTranslationNotesHtml({
    catalogEntry,
    expandedBooks,
    renderOptions,
    authToken,
    appVersion: APP_VERSION,
    renderNewCopy,
  });

  const onBibleReferenceChange = (b, c, v) => {
    if (b && !expandedBooks.includes(b)) {
      const url = new URL(window.location);
      url.hash = '';
      url.searchParams.delete('book');
      url.searchParams.set('book', b);
      window.history.replaceState(null, '', url);
      window.location.reload();
    } else if (setNavAnchor) {
      let anchorParts = [b];
      if (c != '1' || v != '1') {
        anchorParts.push(c);
      }
      if (v != '1') {
        anchorParts.push(v);
      }
      if (!navAnchor.startsWith(anchorParts.join('-'))) {
        setNavAnchor(anchorParts.join('-'));
      }
    }
  };

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: expandedBooks[0] || catalogEntry?.ingredients?.[0]?.identifier || 'gen',
    initialChapter: parseInt(urlInfo.hashParts[1]) || 1,
    initialVerse: parseInt(urlInfo.hashParts[2]) || 1,
    onChange: onBibleReferenceChange,
  });

  // Handle navigation anchor changes
  useEffect(() => {
    if (navAnchor && !navAnchor.includes('--')) {
      const parts = navAnchor.split('-');
      if (bibleReferenceState.bookId == parts[0] && (bibleReferenceState.chapter != (parts[1] || '1') || bibleReferenceState.verse != (parts[2] || '1'))) {
        bibleReferenceActions.goToBookChapterVerse(parts[0], parts[1] || '1', parts[2] || '1');
      }
    }
  }, [navAnchor]);

  // Initialize supported books and book title
  useEffect(() => {
    const setInitialBookIdAndSupportedBooks = async () => {
      let repoFileList = null;
      try {
        repoFileList = (await getRepoGitTrees(catalogEntry.repo.url, catalogEntry.branch_or_tag_name, authToken, false)).map((tree) => tree.path);
      } catch (e) {
        console.log(`Error calling getRepoGitTrees(${catalogEntry.repo.url}, ${catalogEntry.branch_or_tag_name}, false): `, e);
      }

      let sb = getSupportedBooks(catalogEntry, repoFileList);
      if (!sb.length) {
        setErrorMessage('There are no books in this resource to render.');
        return;
      }
      if (!sb.includes(expandedBooks[0])) {
        setErrorMessage(`This resource does not support the rendering of the book \`${expandedBooks[0]}\`. Please choose another book to render.`);
        sb = [expandedBooks[0], ...sb];
      }
      setSupportedBooks(sb);
      if (sb[0] === expandedBooks[0]) {
        setIsDefaultBook(true);
      }
      bibleReferenceActions.applyBooksFilter(sb);

      const title = catalogEntry.ingredients.filter((ingredient) => ingredient.identifier == expandedBooks[0]).map((ingredient) => ingredient.title)[0] || expandedBooks[0];
      setBookTitle(title);

      setStatusMessage(
        <>
          Preparing preview for {title}.
          <br />
          Please wait...
        </>
      );
    };

    if (catalogEntry && !supportedBooks.length && !errorMessages && expandedBooks.length) {
      setCanChangeColumns(false);
      setInitialBookIdAndSupportedBooks();
    }
  }, [
    urlInfo,
    catalogEntry,
    expandedBooks,
    errorMessages,
    supportedBooks,
    authToken,
    setCanChangeColumns,
    setErrorMessage,
    setStatusMessage,
    setBookTitle,
    setSupportedBooks,
    setIsDefaultBook,
  ]);

  // Handle loading state
  useEffect(() => {
    if (loading) {
      setStatusMessage(
        <>
          Generating preview for {bookTitle}...
          <br />
          Please wait...
        </>
      );
    }
  }, [loading, bookTitle, setStatusMessage]);

  // Handle errors
  useEffect(() => {
    if (error) {
      setErrorMessage(error);
    }
  }, [error, setErrorMessage]);

  // Set HTML sections when data is ready
  useEffect(() => {
    if (htmlData && !loading && !error) {
      setHtmlSections((prevState) => ({
        ...prevState,
        css: htmlData.css,
        cover: `<h3>${bookTitle}</h3>` + (renderOptions.chaptersOrigStr ? `<h4>Chapters: ${renderOptions.chaptersOrigStr}</h4>` : ''),
        copyright: htmlData.copyright,
        body: htmlData.html,
      }));

      if (htmlData.builtWith) {
        setBuiltWith(htmlData.builtWith);
      }

      setStatusMessage(htmlData.fromCache ? 'Loaded from cache' : 'Generated successfully');
      // Clear status after a short delay
      setTimeout(() => setStatusMessage(''), 2000);
    }
  }, [htmlData, loading, error, bookTitle, renderOptions, setHtmlSections, setBuiltWith, setStatusMessage]);

  return <BibleReference status={bibleReferenceState} actions={bibleReferenceActions} style={{ minWidth: 'auto' }} />;
}
