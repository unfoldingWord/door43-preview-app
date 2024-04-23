import { useState, useEffect } from 'react';

export default function useFetchCatalogEntriesBySubject({ catalogEntries, subject, bookId, firstOnly, setErrorMessage }) {
  const [matchingCatalogEntries, setMatchingCatalogEntries] = useState([]);

  useEffect(() => {
    const determineCatalogEntryBySubject = () => {
      let entries = [];
      outerLoop:
      for(let entry of catalogEntries) {
        if (entry.subject == subject) {
          for(let ingredient of entry.ingredients) {
            if (!bookId || ingredient.identifier == bookId) {
              entries.push(entry);
              if( firstOnly ) {
                break outerLoop;
              }
            }
          }
        }
      }
      if (!entries.length) {
        setErrorMessage(`No relation found of subject \`${subject}\` for this resource${bookId ? ` for book \`${bookId}\`` : ''}.`);
        return;
      }
      setMatchingCatalogEntries(entries);
    };

    if (catalogEntries && subject) {
      determineCatalogEntryBySubject();
    }
  }, [catalogEntries, firstOnly, subject, bookId, setErrorMessage]);

  return matchingCatalogEntries;
}
