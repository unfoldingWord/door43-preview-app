import { useState, useEffect, useContext } from 'react';
import { getRepoContentsContent } from '@helpers/dcsApi';
import { AppContext } from '@components/App.context';

export default function useFetchBookFiles({ catalogEntries, bookId, canFetch = true }) {
  const [bookFiles, setBookFiles] = useState();
  const {
    state: { authToken },
    actions: { setErrorMessage }
  } = useContext(AppContext);

  useEffect(() => {
    const fetchBookFileContents = async () => {
      if (!catalogEntries || ! catalogEntries.length || !bookId) {
        return;
      }

      const promises = [];
      catalogEntries.forEach((catalogEntry) => {
        if (!catalogEntry) {
          return;
        }
        let filePath = '';
        catalogEntry?.ingredients?.forEach((ingredient) => {
          if (ingredient.identifier == bookId) {
            filePath = ingredient.path.replace(/^\./, '');
          }
        });
        if (!filePath) {
          setErrorMessage(`The required related resource ${catalogEntry?.full_name} (${catalogEntry?.subject}) does not contain a project for \`${bookId}\`.`);
          return;
        }
        promises.push(getRepoContentsContent(catalogEntry.repo.url, filePath, catalogEntry.branch_or_tag_name, authToken));
      });

      try {
        const contents = await Promise.all(promises.map(promise => promise.catch(error => {
          console.log(error); // Log the error
          return null; // Return null or any other value to indicate the error
        })));
        setBookFiles(contents.filter(content => content));
      } catch (error) {
        console.log(error); // Handle any error that occurred during Promise.all
      }
    };

    if (canFetch && catalogEntries && catalogEntries.length) {
      fetchBookFileContents();
    }
  }, [catalogEntries, bookId, authToken, canFetch, setErrorMessage]);

  return bookFiles;
}