import { BibleBookData } from '@common/books';
import pako from 'pako';

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

export const uploadCachedBook = async (owner, repo, ref, bookId, previewVersion, catalogEntry, builtWith, htmlSections) => {
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
  const compressedData = pako.gzip(jsonString, { to: 'string' });
  console.log('Compressed Data Size:', compressedData?.length);

  const verification = import.meta.env.VITE_PREVIEW_VERIFICATION_KEY;
  const path = `u/${owner}/${repo}/${ref}/${bookId}.json.gz`;

  try {
    const response = await fetch(`/.netlify/functions/cache-html?path=${encodeURIComponent(path)}&verification=${encodeURIComponent(verification)}`, {
      method: 'POST',
      body: compressedData,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });
    if (response.ok) {
      console.log('Upload Success', await response.json());
    } else {
      console.log('UploadFailed', response);
    }
  } catch (err) {
    console.log('Upload Failed. Error: ', err);
  }
}

export const downloadOl2GlQuoteDictionary = async (url) => {
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

export const uploadOl2GlQuoteDictionary = async (owner, repo, ref, bookId, previewVersion, builtWith, ol2GlQuoteDictionary) => {
  const payload = {
    bookId: bookId,
    preview_version: previewVersion,
    date_iso: new Date().toISOString(),
    date_unix: new Date().getTime(),
    ol2gl_quote_dictionary: ol2GlQuoteDictionary,
    builtWith: {},
  };

  console.log('Uploading OL2GL Quote Dictionary:', payload);

  builtWith.forEach((entry) => {
    payload.builtWith[entry.full_name] = entry.commit_sha;
  });

  const jsonString = JSON.stringify(payload);
  const compressedData = pako.gzip(jsonString, { to: 'string' });
  console.log('Compressed Data Size:', compressedData?.length);

  const verification = import.meta.env.VITE_PREVIEW_VERIFICATION_KEY;
  const path = `u/${owner}/${repo}/${ref}/${bookId}-ol2gl_quote_dictionary.json.gz`;

  try {
    const response = await fetch(`/.netlify/functions/cache-html?path=${encodeURIComponent(path)}&verification=${encodeURIComponent(verification)}`, {
      method: 'POST',
      body: compressedData,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });
    if (response.ok) {
      console.log('Upload Success', await response.json());
    } else {
      console.log('UploadFailed', response);
    }
  } catch (err) {
    console.log('Upload Failed. Error: ', err);
  }
}