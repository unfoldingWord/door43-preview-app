import * as JSZip from 'jszip'

export const getZipFileDataForCatalogEntry = async (catalogEntry) => {
    return await fetch(catalogEntry.zipball_url, {cache: "default"})
        .then(response => response.arrayBuffer())
        .then(data => JSZip.loadAsync(data))
}
