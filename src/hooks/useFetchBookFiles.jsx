import { useState, useEffect, useContext } from 'react';
import { getRepoContentsContent } from '../helpers/dcsApi';
import { AppContext } from '@components/App.context';

export default function useFetchBookFiles({ catalogEntries, bookId, setErrorMessage }) {
  const [bookFiles, setBookFiles] = useState([]);
  const {
    state: { authToken },
  } = useContext(AppContext);

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
        promises.push(getRepoContentsContent(catalogEntry.repo.url, filePath, catalogEntry.branch_or_tag_name, authToken));
      });

      const contents = await Promise.all(promises);
      setBookFiles(contents);
    };

    fetchBookFileContents();
  }, [catalogEntries, bookId, authToken, setErrorMessage]);

  return bookFiles;
}