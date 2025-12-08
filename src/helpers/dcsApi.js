import * as base64 from './base64';

export const getCatalogEntry = async (apiUrl, owner, repo, ref, authToken = '') => {
  const catalogEntryUrl = `${apiUrl}/catalog/entry/${owner}/${repo}/${ref}`;
  return fetch(catalogEntryUrl, {
    cache: 'default',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
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
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
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
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
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
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    })
    .then((response) => {
      if (!response || !response.ok) {
        throw new Error(`Unable to get contents of repo on DCS.`);
      }
      return response.json();
    })
    .then((json) => base64.decode(json.content));
};

export const getRepoGitTrees = async (repoApiUrl, ref, authToken = '', recursive = true, page = 1, allItems = []) => {
  const repoGitTreesUrl = `${repoApiUrl}/git/trees/${ref}?recursive=${recursive}&page=${page}`;
  return fetch(repoGitTreesUrl,
  {
    cache: 'default',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  }).then(async (response) => {
    if (!response || !response.ok) {
      throw new Error(`Unable to get directory listing of repo on DCS.`);
    } else {
      const treeData = await response.json();
      allItems.push(...treeData.tree);
      // If there are more items to fetch, call the function recursively with the next page number
      if (allItems.length < treeData.total_count) {
        return await getRepoGitTrees(repoApiUrl, ref, authToken, recursive, page + 1, allItems);
      } else {
        // If all items have been fetched, return them
        return allItems;
      }
    }
  });
};

// resourceToSubjectMap are the valid subjects keyed by their resource ID
var resourceToSubjectMap = {
	"glt":         "Aligned Bible",
	"gst":         "Aligned Bible",
	"obs-sn":      "TSV OBS Study Notes",
	"obs-sq":      "TSV OBS Study Questions",
	"obs-tn":      "TSV OBS Translation Notes",
	"obs-tq":      "TSV OBS Translation Questions",
	"obs":         "Open Bible Stories",
	"obs-twl":     "TSV OBS Translation Words Links",
	"sn":          "TSV Study Notes",
	"sq":          "TSV Study Questions",
	"ta":          "Translation Academy",
	"tl":          "Training Library",
	"tn":          "TSV Translation Notes",
	"tq":          "TSV Translation Questions",
	"tw":          "Translation Words",
	"twl":         "TSV Translation Word Links",
	"twl-tsv":     "TSV Translation Words Links",
	"ult":         "Aligned Bible",
	"ust":         "Aligned Bible",
}

// GetSubjectFromRepoName determines the subject of a repo by its repo name
export const getSubjectFromRepoName = (repoName) => {
  let parts = repoName.toLowerCase().split("_");
  if (parts.length === 2 && resourceToSubjectMap[parts[1]]) {
    return resourceToSubjectMap[parts[1]];
  }
  if (parts.length === 4 && parts[3] === "book") {
    return "Aligned Bible";
  }
  if (parts.length === 4 && parts[2] === "text") {
    if (parts[1] === "obs") {
      return "Open Bible Stories";
    }
    return "Bible";
  }
  parts = repoName.split("-");
  if (parts.length === 3) {
    if (parts[1] === "textstories") {
      return "Open Bible Stories";
    } else if (parts[2] === "texttranslation") {
      return "Bible";
    }
  }
  return "";
};

// getMetadataTypeFromRepoName determines the metadata type of a repo by its repo name format
export const getMetadataTypeFromRepoName = (repoName) => {
	let parts = repoName.toLowerCase().split("_")
	if (parts.length === 2) {
		return "rc"
	}
	if (parts.length == 4 && parts[3] == "book") {
		return "tc"
	}
	if (parts.length == 4 && parts[2] == "text") {
		return "ts"
	}
	parts = repoName.toLowerCase().split("-")
	if (parts.length == 3 && (parts[1] == "textstories" || parts[1] == "texttranslation")) {
		return "sb"
	}
	return ""
}