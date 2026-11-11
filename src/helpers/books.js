import { BibleBookData } from '@common/books';
import pako from 'pako';

// Max bytes of gzipped cache data sent per request; must stay under the reverse proxy's body limit (nginx default: 1MB)
const CACHE_UPLOAD_CHUNK_SIZE = 768 * 1024;

// supported books are books that are both in the ingredients of a catalog entry and have existing files in zip file
export const getSupportedBooks = (catalogEntry, fileList = null, books = []) => {
  let supportedBooks = [];
  catalogEntry.ingredients.forEach((ingredient) => {
    const id = ingredient.identifier;
    if (!(id in BibleBookData) || (books.length > 0 && !books.includes(id))) {
      return;
    }
    if (fileList) {
      if (fileList.includes(ingredient.path.replace(/^\.\//, ''))) {
        supportedBooks.push(id);
      }
    } else {
      supportedBooks.push(id);
    }
  });
  return supportedBooks;
};

export const downloadCachedBook = async (url) => {
  try {
    const response = await fetch(url, {
      cache: 'reload',
    });
    if (response.ok) {
      const jsonString = pako.inflate(new Uint8Array(await response.arrayBuffer()), { to: 'string' });
      if (jsonString) {
        return JSON.parse(jsonString);
      } else {
        console.log(`No JSON file found in the zip at ${url}`);
      }
    } else {
      console.log(`Bad response from server for ${url}: `, response.status, response.statusText);
    }
  } catch (err) {
    console.log(`Error fetching cached book at ${url}: `, err.message);
  }
  return null;
};

export const uploadCachedBook = async (owner, repo, ref, bookId, previewVersion, catalogEntry, builtWith, htmlSections, verificationKey) => {
  const cachedBook = {
    bookId: bookId,
    preview_version: previewVersion,
    date_iso: new Date().toISOString(),
    date_unix: new Date().getTime(),
    commit_sha: catalogEntry.commit_sha,
    htmlSections: htmlSections,
    catalogEntry: catalogEntry,
    builtWith: {},
  };

  builtWith.forEach((entry) => {
    cachedBook.builtWith[entry.full_name] = entry.commit_sha;
  });

  const jsonString = JSON.stringify(cachedBook);
  const compressedData = pako.gzip(jsonString);
  console.log('Compressed Data Size:', compressedData?.length);

  const path = `u/${owner}/${repo}/${ref}/${bookId}.json.gz`;
  const baseUrl = `/api/save-html-to-cache?path=${encodeURIComponent(path)}&verification=${encodeURIComponent(verificationKey)}`;

  // Large books are sent in several requests so no single request body exceeds the
  // reverse proxy's body size limit (nginx's default is 1MB, anything over gets a 413).
  const chunks = Math.max(1, Math.ceil(compressedData.length / CACHE_UPLOAD_CHUNK_SIZE));
  const uploadId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  try {
    let response;
    for (let chunk = 0; chunk < chunks; chunk++) {
      const url = chunks > 1 ? `${baseUrl}&uploadId=${uploadId}&chunk=${chunk}&chunks=${chunks}` : baseUrl;
      response = await fetch(url, {
        method: 'POST',
        body: compressedData.subarray(chunk * CACHE_UPLOAD_CHUNK_SIZE, (chunk + 1) * CACHE_UPLOAD_CHUNK_SIZE),
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });
      if (!response.ok) {
        break;
      }
    }
    if (response.ok) {
      console.log('Upload Success', await response.json());
    } else {
      console.log('UploadFailed', response.status, response.statusText);
    }
  } catch (err) {
    console.log('Upload Failed. Error: ', err);
  }
}
