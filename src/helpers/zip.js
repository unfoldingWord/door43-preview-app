import JSZip from 'jszip';

export const getZipFileDataForCatalogEntry = async (catalogEntry, authToken) => {
  return await fetch(catalogEntry.zipball_url + (authToken ? `?token=${authToken}` : ''), { cache: 'default' })
    .then((response) => response.arrayBuffer())
    .then((data) => JSZip.loadAsync(data));
};
