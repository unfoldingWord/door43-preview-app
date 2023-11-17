repoObj = await repoClient.repoGet({owner, repo}).then(({ data }) => data)

const response = await repoClient.repoSearch({
  owner: selectedOrganization, 
  subject:bibleSubjects.join(',')
})

import { RepositoryApi, OrganizationApi, CatalogApi } from 'dcs-js';
//const catalogEntry = await catalogClient.catalogGetEntry({owner, repo, tag: ref}).then(({ data }) => data)

response = await organizationClient.orgListUserOrgs({username: authentication.user.login})
} else {
  response = await organizationClient.orgGetAll()
}

if (response.status === 200) {
  setOrganizations( response.data.filter((org) => org.repo_subjects && org.repo_subjects.some((subject) => bibleSubjects.includes(subject)))
    .map(org => org.username)
  )
}
setLoading(false)
}
if ( organizationClient ) {
getOrgs().catch(console.error)
}
