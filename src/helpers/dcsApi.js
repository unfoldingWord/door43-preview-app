import * as base64 from './base64';

export const getCatalogEntry = async (catalogApiUrl, owner, repo, ref, token = '') => {
  const catalogEntryUrl = `${catalogApiUrl}/entry/${owner}/${repo}/${ref}${token ? `?token=${token}` : ''}`;
  return fetch(catalogEntryUrl, { cache: 'default' }).then((response) => {
    if (!response || !response.ok) {
      throw new Error(`Unable to get catalog entry of repo on DCS.`);
    } else {
      return response.json();
    }
  });
};

export const getRepo = async (repoApiUrl, owner, repo, authToken = '') => {
  const repoUrl = `${repoApiUrl}/${owner}/${repo}${authToken ? `?token=${authToken}` : ''}`;
  return fetch(repoUrl, { cache: 'default' }).then((response) => {
    if (!response || !response.ok) {
      throw new Error(`Unable to get repo on DCS.`);
    } else {
      return response.json();
    }
  });
};

export const getRepoContentsContent = async (repoApiUrl, filePath, ref, authToken = '', recursive = true) => {
  const repoContentsUrl = `${repoApiUrl}/contents/${filePath}?ref=${ref}&recursive=${recursive}${authToken ? `&token=${authToken}` : ''}`;
  return fetch(repoContentsUrl, { cache: 'default' })
    .then((response) => {
      if (!response || !response.ok) {
        throw new Error(`Unable to get contents of repo on DCS.`);
      }
      return response.json();
    })
    .then((json) => base64.decode(json.content));
};

export const getRepoGitTrees = async (repoApiUrl, ref, authToken = '', recursive = true) => {
  const repoGitTreesUrl = `${repoApiUrl}/git/trees/${ref}?recursive=${recursive}${authToken ? `&token=${authToken}` : ''}`;
  return fetch(repoGitTreesUrl, { cache: 'default' }).then((response) => {
    if (!response || !response.ok) {
      throw new Error(`Unable to get directory listting of repo on DCS.`);
    } else {
      return response.json();
    }
  });
};
