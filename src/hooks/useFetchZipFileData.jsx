import { useState, useEffect, useContext } from 'react';
import { getZipFileDataForCatalogEntry } from '@helpers/zip';
import { AppContext } from '@components/App.context';

export default function useFetchZipFileData({ catalogEntry, canFetch = true }) {
  const [zipFileData, setZipFileData] = useState();
  const {
    state: { authToken },
    actions: { setErrorMessage }
  } = useContext(AppContext);

  useEffect(() => {
    const loadZipFileData = async () => {
      getZipFileDataForCatalogEntry(catalogEntry, authToken).
      then((zip) => setZipFileData(zip)).
      catch((error) => {
        console.log(error);
        setErrorMessage(<>Unable to fetch <a href={catalogEntry.zipball_url} target="_blank" rel="noreferrer">the zip file</a> for this project</>)
      });
    };

    if (canFetch && catalogEntry) {
      loadZipFileData();
    }
  }, [canFetch, catalogEntry, authToken, setErrorMessage]);

  return zipFileData;
}
