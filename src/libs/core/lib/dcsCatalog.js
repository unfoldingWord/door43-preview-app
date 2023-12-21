export const getRelationCatalogEntries = async (catalogApiUrl, relation, owners, stage) => {
    if (!catalogApiUrl || !relation) {
        return []
    }
    if (!stage || !['prod', 'preprod', 'latest'].includes(stage.toLowerCase())) {
        stage = "prod"
    }
    if (!owners) {
        owners = ['unfoldingword']
    }
    const repoParams = relation.map(r => `repo=${r.split('?')[0].replace('/', '_')}`).join('&')
    const ownerParams = owners.map(o => `owner=${o}`).join('&')
    const resp = await fetch(`${catalogApiUrl}/search?${repoParams}&${ownerParams}&stage=${stage}`)
    if (!resp.ok) {
        throw new Error("Unable to search DCS catalog")
    }
    const json = await resp.json()
    if (!json.ok) {
        throw new Error(resp.message)
    }
    let entries = []
    let found = {}
    owners.forEach(owner => {
        json.data.forEach(entry => {
            if (entry.repo.owner.username.toLowerCase() == owner.toLowerCase()) {
                if(!(entry.repo.name.toLowerCase() in found)) {
                    entries.push(entry)
                    found[entry.repo.name.toLowerCase()] = true
                }
            }
        })
    })
    return entries
}