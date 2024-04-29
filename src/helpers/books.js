import { BibleBookData } from '@common/books';
import pako from 'pako';

// supported books are books that are both in the ingredients of a catalog entry and have existing files in zip file
export const getSupportedBooks = (catalogEntry, fileList = null) => {
  let supportedBooks = [];
  catalogEntry.ingredients.forEach((ingredient) => {
    const id = ingredient.identifier;
    if (!(id in BibleBookData)) {
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

export const downloadCachedBook = async (owner, repo, ref, bookId) => {
  const url = `https://s3.us-west-2.amazonaws.com/${import.meta.env.VITE_PREVIEW_S3_BUCKET_NAME}/u/${owner}/${repo}/${ref}/${bookId}.gzip`;
  try {
    const response = await fetch(url);
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
  } catch(err) {
    console.log(`Error fetching cached book at ${url}: `, err.message);
  }
  return null;
};

export const uploadCachedBook = async (owner, repo, ref, bookId, previewVersion, catalogEntry, htmlSections) => {
  const cachedBook = {
    bookId: bookId,
    preview_version: previewVersion,
    date_iso: new Date().toISOString(),
    date_unix: new Date().getTime(),
    commit_sha: catalogEntry.commit_sha,
    htmlSections: htmlSections,
    catalogEntry: catalogEntry,
  };

  const jsonString = JSON.stringify(cachedBook);
  const compressedData = pako.gzip(jsonString, { to: 'string' });
  console.log('Compressed Data Size:', compressedData?.length);

  const verification = import.meta.env.VITE_PREVIEW_VERIFICATION_KEY;
  const path = `u/${owner}/${repo}/${ref}/${bookId}.gzip`;

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