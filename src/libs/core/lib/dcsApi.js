import * as base64 from './base64'

export const getCatalogEntry = async (catalogApiUrl, owner, repo, ref) => {
    const catalogEntryUrl = `${catalogApiUrl}/entry/${owner}/${repo}/${ref}`
    return fetch(catalogEntryUrl, {cache: "no-cache"}).then(response => {
        if (! response || ! response.ok) {
          throw new Error(`Unable to get catalog entry of repo on DCS.`)
        }
        else {
            return response.json()
        }
    })
}

export const getRepoContentsContent = async (repoApiUrl, filePath, ref, recursive=true) => {
    const repoContentsUrl = `${repoApiUrl}/contents/${filePath}?ref=${ref}&recursive=${recursive}`
    return fetch(repoContentsUrl, {cache: "no-cache"}).then(response => {
        if (! response || ! response.ok) {
          throw new Error(`Unable to get contents of repo on DCS.`)
        }
        else {
            return response.json()
        }
    }).then(json => base64.decode(json.content))
}

export const getRepoGitTrees = async (repoApiUrl, ref, recursive=true) => {
    const repoGitTreesUrl = `${repoApiUrl}/git/trees/${ref}?recursive=${recursive}`
    return fetch(repoGitTreesUrl, {cache: "no-cache"}).then(response => {
        if (! response || ! response.ok) {
          throw new Error(`Unable to get director listting of repo on DCS.`)
        }
        else {
            return response.json()
        }
    })
}
