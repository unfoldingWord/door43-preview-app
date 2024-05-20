import { useState, useEffect } from 'react';
import { getZipFileDataForCatalogEntry } from '@helpers/zip';

export default function useFetchZipFileData({ catalogEntry, setErrorMessage, authToken = '' }) {
  const [zipFileData, setZipFileData] = useState();

  useEffect(() => {
    const loadZipFileData = async () => {
      getZipFileDataForCatalogEntry(catalogEntry, authToken).
      then((zip) => setZipFileData(zip)).
      catch((error) => {
        console.log(error);
        setErrorMessage(<>Unable to fetch <a href={catalogEntry.zipball_url} target="_blank" rel="noreferrer">the zip file</a> for this project</>)
      });
    };

    if (catalogEntry) {
      loadZipFileData();
    }
  }, [catalogEntry, authToken]);

  return zipFileData;
}
