import * as base64 from './base64';

export const getCatalogEntry = async (apiUrl, owner, repo, ref, authToken = '') => {
  const catalogEntryUrl = `${apiUrl}/catalog/entry/${owner}/${repo}/${ref}`;
  return fetch(catalogEntryUrl, {
    cache: 'default',
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  }).then((response) => {
    if (response && response.ok) {
      return response.json();
    }
  });
};

export const getRepo = async (apiUrl, owner, repo, authToken = '') => {
  const repoUrl = `${apiUrl}/repos/${owner}/${repo}`;
  return fetch(repoUrl, {
    cache: 'default',
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  }).then((response) => {
    if (!response || !response.ok) {
      throw new Error(`Unable to get repo on DCS.`);
    } else {
      return response.json();
    }
  });
};

export const getOwner = async (apiUrl, owner, authToken = '') => {
  const usersUrl = `${apiUrl}/users/${owner}`;
  return fetch(usersUrl, {
    cache: 'default',
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  }).then((response) => {
    if (!response || !response.ok) {
      throw new Error(`Unable to get owner on DCS.`);
    } else {
      return response.json();
    }
  });
};

export const getRepoContentsContent = async (repoApiUrl, filePath, ref, authToken = '', recursive = true) => {
  const repoContentsUrl = `${repoApiUrl}/contents/${filePath}?ref=${ref}&recursive=${recursive}`;
  return fetch(repoContentsUrl,
    {
      cache: 'default',
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })
    .then((response) => {
      if (!response || !response.ok) {
        throw new Error(`Unable to get contents of repo on DCS.`);
      }
      return response.json();
    })
    .then((json) => base64.decode(json.content));
};

export const getRepoGitTrees = async (repoApiUrl, ref, authToken = '', recursive = true) => {
  const repoGitTreesUrl = `${repoApiUrl}/git/trees/${ref}?recursive=${recursive}`;
  return fetch(repoGitTreesUrl,
  {
    cache: 'default',
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  }).then((response) => {
    if (!response || !response.ok) {
      throw new Error(`Unable to get directory listting of repo on DCS.`);
    } else {
      return response.json();
    }
  });
};
