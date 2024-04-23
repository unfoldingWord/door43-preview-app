import { useState, useEffect } from 'react';
import { getRepoContentsContent } from '../helpers/dcsApi';

export default function useFetchBookFiles({ catalogEntries, bookId, setErrorMessage }) {
  const [bookFiles, setBookFiles] = useState([]);

  useEffect(() => {
    const fetchBookFileContents = async () => {
      if (!catalogEntries || !bookId) {
        return;
      }

      const promises = [];
      console.log("CATALOG ENTRIES", catalogEntries)
      catalogEntries.forEach((catalogEntry) => {
        let filePath = '';
        catalogEntry.ingredients.forEach((ingredient) => {
          if (ingredient.identifier == bookId) {
            filePath = ingredient.path.replace(/^\./, '');
          }
        });
        if (!filePath) {
          setErrorMessage(`The required related resource ${catalogEntry.full_name} (${catalogEntry.subject}) does not contain a project for \`${bookId}\`.`);
          return;
        }
        promises.push(getRepoContentsContent(catalogEntry.repo.url, filePath, catalogEntry.branch_or_tag_name));
      });

      const contents = await Promise.all(promises);
      setBookFiles(contents);
    };

    fetchBookFileContents();
  }, [catalogEntries, bookId, setErrorMessage]);

  return bookFiles;
}