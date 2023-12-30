import { useState, useEffect } from "react";
import { getZipFileDataForCatalogEntry } from "../lib/zip.js";

export default function useFetchZipFileData({ catalogEntry }) {
  const [zipFileData, setZipFileData] = useState();

  useEffect(() => {
    const loadZipFileData = async () => {
      getZipFileDataForCatalogEntry(catalogEntry).then((zip) =>
        setZipFileData(zip)
      );
    };

    if (catalogEntry) {
      loadZipFileData();
    }
  }, [catalogEntry]);

  return zipFileData;
}
