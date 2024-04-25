import { useState, useEffect } from 'react';
import { getZipFileDataForCatalogEntry } from '../helpers/zip';

export default function useFetchZipFileData({ catalogEntry, authToken = '' }) {
  const [zipFileData, setZipFileData] = useState();

  useEffect(() => {
    const loadZipFileData = async () => {
      getZipFileDataForCatalogEntry(catalogEntry, authToken).then((zip) => setZipFileData(zip));
    };

    if (catalogEntry) {
      loadZipFileData();
    }
  }, [catalogEntry, authToken]);

  return zipFileData;
}
