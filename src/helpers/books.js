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

export const getCachedBook = async (owner, repo, ref, book) => {
  const url = `https://s3.us-west-2.amazonaws.com/${import.meta.env.VITE_PREVIEW_S3_BUCKET_NAME}/u/${owner}/${repo}/${ref}/${book || 'all'}.gzip`;
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