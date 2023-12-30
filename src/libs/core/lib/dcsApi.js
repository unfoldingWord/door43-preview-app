import * as base64 from "./base64.js"

export const getCatalogEntry = async (catalogApiUrl, owner, repo, ref) => {
    const catalogEntryUrl = `${catalogApiUrl}/entry/${owner}/${repo}/${ref}`
    return fetch(catalogEntryUrl).then(response => {
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
    return fetch(repoContentsUrl).then(response => {
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
    return fetch(repoGitTreesUrl).then(response => {
        if (! response || ! response.ok) {
          throw new Error(`Unable to get director listting of repo on DCS.`)
        }
        else {
            return response.json()
        }
    })
}
