import JSZip from 'jszip';

export const getZipFileDataForCatalogEntry = async (catalogEntry, authToken = '') => {
  return await fetch(catalogEntry.zipball_url, { 
    cache: 'default',
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  })
    .then((response) => response.arrayBuffer())
    .then((data) => JSZip.loadAsync(data));
};
