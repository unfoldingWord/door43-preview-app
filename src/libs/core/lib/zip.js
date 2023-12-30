import * as JSZip from 'jszip'

export const getZipFileDataForCatalogEntry = async (catalogEntry) => {
    return await fetch(catalogEntry.zipball_url)
        .then(response => response.arrayBuffer())
        .then(data => JSZip.loadAsync(data))
}
