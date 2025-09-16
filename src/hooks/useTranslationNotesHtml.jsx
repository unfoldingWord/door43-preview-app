import { useState, useEffect } from 'react';
import { generateTranslationNotesHtml } from '@utils/translationNotesRenderer';

/**
 * Simple hook to generate or fetch cached Translation Notes HTML
 */
export default function useTranslationNotesHtml({ catalogEntry, expandedBooks, renderOptions, authToken, appVersion, renderNewCopy = false }) {
  const [htmlData, setHtmlData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchHtml() {
      if (!catalogEntry || !expandedBooks?.length) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await generateTranslationNotesHtml(catalogEntry, expandedBooks, renderOptions, authToken, appVersion);

        setHtmlData(result);
      } catch (err) {
        console.error('Error generating Translation Notes HTML:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchHtml();
  }, [catalogEntry, expandedBooks, renderOptions, authToken, appVersion, renderNewCopy]);

  return {
    htmlData,
    loading,
    error,
  };
}
