// React imports
import { useState, useEffect, useContext } from 'react';

// Bible reference imports
import BibleReference, { useBibleReference } from 'bible-reference-rcl';
import { BibleBookData } from '@common/books';

// Context imports
import { AppContext } from '@components/App.context';

// Renderer import - THE MAGIC! 🎉
import { generateTranslationNotesHtml } from '../renderers/translationNotesRenderer.js';

/**
 * Simplified RcTranslationNotes Component
 * 
 * This component is now ~100 lines instead of 1000+ lines!
 * All the complex logic is in the standalone renderer.
 */
export default function RcTranslationNotes() {
  const {
    state: {
      urlInfo,
      catalogEntry,
      navAnchor,
      renderOptions,
      authToken,
      expandedBooks,
    },
    actions: {
      setStatusMessage,
      setErrorMessage,
      setHtmlSections,
      setNavAnchor,
      setBuiltWith,
      setSupportedBooks,
      setCanChangeColumns,
    },
  } = useContext(AppContext);

  const [renderState, setRenderState] = useState({
    html: null,
    error: null,
    progress: { message: '', percent: 0 },
  });

  // Bible reference handling
  const onBibleReferenceChange = (b, c, v) => {
    if (setNavAnchor) {
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
    initialBook: expandedBooks?.[0] || 'gen',
    initialChapter: parseInt(urlInfo?.hashParts?.[1]) || 1,
    initialVerse: parseInt(urlInfo?.hashParts?.[2]) || 1,
    onChange: onBibleReferenceChange,
  });

  // Initialize - set supported books and CSS
  useEffect(() => {
    if (!catalogEntry) {
      return;
    }

    // Determine supported books from catalog entry
    const supportedBooks = catalogEntry.ingredients
      .filter((ingredient) => ingredient.categories?.includes('bible'))
      .map((ingredient) => ingredient.identifier)
      .filter((bookId) => bookId in BibleBookData);

    if (supportedBooks.length) {
      bibleReferenceActions.applyBooksFilter(supportedBooks);
      setSupportedBooks(supportedBooks);
    }

    setCanChangeColumns(true);

    setStatusMessage(
      <>
        Preparing preview for {catalogEntry.title}.
        <br />
        Please wait...
      </>
    );
  }, [catalogEntry, setCanChangeColumns, setStatusMessage, setSupportedBooks]);

  // Main rendering effect - THIS IS WHERE THE MAGIC HAPPENS! ✨
  useEffect(() => {
    if (!catalogEntry || !expandedBooks?.length) {
      return;
    }

    const generateHtml = async () => {
      try {
        setRenderState((prev) => ({
          ...prev,
          progress: { message: 'Starting...', percent: 0 },
        }));

        const result = await generateTranslationNotesHtml({
          owner: urlInfo.owner,
          repo: urlInfo.repo,
          ref: catalogEntry.branch_or_tag_name,
          bookId: expandedBooks[0],
          catalogEntry,
          authToken,
          renderOptions,
          onProgress: (message, percent) => {
            setRenderState((prev) => ({
              ...prev,
              progress: { message, percent },
            }));
            setStatusMessage(
              <>
                {message}
                <br />
                {percent}% complete
              </>
            );
          },
        });

        // Success! Update state
        setRenderState({
          html: result.html,
          error: null,
          progress: { message: 'Complete!', percent: 100 },
        });

        setHtmlSections({
          css: result.css,
          body: result.html,
        });

        setBuiltWith(Object.values(result.builtWith).filter(Boolean));
        setStatusMessage('');
      } catch (error) {
        console.error('Error generating Translation Notes:', error);
        setRenderState({
          html: null,
          error,
          progress: { message: 'Error', percent: 0 },
        });
        setErrorMessage(error.message || 'Failed to generate Translation Notes');
      }
    };

    generateHtml();
  }, [catalogEntry, expandedBooks, authToken, renderOptions, urlInfo]);

  // Handle navigation
  useEffect(() => {
    if (navAnchor && !navAnchor.includes('--')) {
      const parts = navAnchor.split('-');
      if (
        bibleReferenceState.bookId == parts[0] &&
        (bibleReferenceState.chapter != (parts[1] || '1') ||
          bibleReferenceState.verse != (parts[2] || '1'))
      ) {
        bibleReferenceActions.goToBookChapterVerse(parts[0], parts[1] || '1', parts[2] || '1');
      }
    }
  }, [navAnchor, bibleReferenceState, bibleReferenceActions]);

  return (
    <BibleReference
      status={bibleReferenceState}
      actions={bibleReferenceActions}
      style={{ minWidth: 'auto' }}
    />
  );
}
