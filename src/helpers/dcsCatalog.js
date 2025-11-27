export const getCatalogEntryByRef = async (apiUrl, owners = ['unfoldingWord', 'Door43-Catalog'], repo, ref = 'master', stage = 'prod', authToken = '') => {
  // Try first to find the catalog entry given the ref and all the owners
  let repos = [repo];
  if (repo.endsWith('_ult')) {
    repos.push(repo.replace(/_ult$/, '_glt'));
  }
  if (repo.endsWith('_ust')) {
    repos.push(repo.replace(/_ust$/, '_gst'));
  }
  for (let owner of owners) {
    for (let r of repos) {
      console.log("Trying to fetch catalog entry for", owner, r, s, `${apiUrl}/catalog/entry/${owner}/${r}/${ref}`);
      let resp = await fetch(`${apiUrl}/catalog/entry/${owner}/${r}/${ref}`, {
        cache: 'default',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (!resp || resp.status != '200')
        continue;
      console.log("Found catalog entry for", owner, r, ref);
      const json = await resp.json();
      if (ref == "master" && stage != "latest") {
        let branch_or_tag_name = json.repo?.catalog?.[stage]?.branch_or_tag_name;
        if (stage == "prod" && !json.repo.catalog?.prod) {
          branch_or_tag_name = json.repo?.catalog?.preprod?.branch_or_tag_name || json.repo?.catalog?.latest?.branch_or_tag_name;
        }
        if (branch_or_tag_name != ref)
          resp = await fetch(`${apiUrl}/catalog/entry/${owner}/${r}/${branch_or_tag_name}`, {
            cache: 'default',
            headers: {
              Authorization: `Bearer ${authToken}`
            }
          });
        if (resp && resp.status == '200') {
          console.log(`Found ${stage} catalog entry for`, owner, r, json.repo.catalog[stage].branch_or_tag_name);
          return await resp.json();
        }
      }
    }
    return json;
  }
}
// Didn't find a ref in the catalog entries of owners, so now find catalog entry of latest tag
if (stage != 'latest') {
  for (let owner of owners) {
    for (let r of repos) {
      console.log("Trying to fetch repo for", owner, r, `${apiUrl}/repos/${owner}/${r}`);
      let resp = await fetch(`${apiUrl}/repos/${owner}/${r}`, {
        cache: 'default',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (resp && resp.status == '200') {
        const repoObj = resp.json();
        if (repoObj?.catalog?.prod) {
          console.log("Found repo for", owner, repo, repoObj.branch_or_tag_name);
          console.log("Trying to fetch catalog entry for", owner, r, repoObj.branch_or_tag_name, `${apiUrl}/catalog/entry/${owner}/${r}/${repoObj.branch_or_tag_name}`);
          resp = await fetch(`${apiUrl}/catalog/entry/${owner}/${repo}/${repoObj.branch_or_tag_name}`, {
            cache: 'default',
            headers: {
              Authorization: `Bearer ${authToken}`
            }
          });
          if (resp && resp.status == '200') {
            console.log("Found catalog entry for", owner, r, repoObj.branch_or_tag_name);
            return await resp.json();
          }
        }
      }
    }
  }
}
// Now we just get the latest catalog entry for the repo if it exists
for (let owner of owners) {
  let resp = await fetch(`${apiUrl}/repos/${owner}/${repo}`, {
    cache: 'default',
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });
  if (resp) {
    const repoObj = resp.json();
    if (repoObj?.catalog?.latest) {
      resp = await fetch(`${apiUrl}/catalog/entry/${owner}/${repo}/${repoObj.branch_or_tag_name}`, {
        cache: 'default',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (resp) {
        return await resp.json();
      }
    }
  }
}
};

export const getCatalogEntryBySubject = async (apiUrl, subject, lang = ['en'], owners = ['unfoldingWord', 'Door43-Catalog'], stage = 'prod') => {
  let stages = [stage];
  if (stage != 'latest') {
    stages.push('latest');
  }
  let langs = [lang];
  if (lang != 'en') {
    langs.push('en');
  }
  for (let l of langs) {
    for (let s of stages) {
      for (let owner of owners) {
        let resp = await fetch(
          `${apiUrl}/catalog/search?owner=${encodeURIComponent(owner)}&stage=${encodeURIComponent(s)}&subject=${encodeURIComponent(subject)}&lang=${encodeURIComponent(l)}`
        );
        if (resp) {
          const entries = await resp.json();
          if (entries?.data?.length > 0) {
            return entries.data[0];
          }
        }
      }
    }
  }
};

export const getRelationCatalogEntries = async (catalogEntry, relation, requiredSubjects = [], authToken = '') => {
  if (!catalogEntry || !relation?.length) {
    return [];
  }
  let apiUrl = catalogEntry.url.replace(/\/api\/v1\/catalog\/.*/, '/api/v1');
  let entries = [];
  let subjects = [];
  for (let rel of relation) {
    let [lang, abbreviation] = rel.split('?')[0].split('/');
    let repo = `${lang}_${abbreviation}`;
    let ref = rel.split('?')?.[1]?.replace(/=/, '');
    let stage = 'prod';
    if (!ref) {
      ref = catalogEntry.repo.default_branch;
      stage = catalogEntry.stage;
    }
    let entry = await getCatalogEntryByRef(apiUrl, [catalogEntry.owner, `${lang}_gl`, 'unfoldingWord', 'Door43-Catalog'], repo, ref, stage, authToken);
    if (!entry) {
      // Try getting English fallback
      entry = await getCatalogEntryByRef(apiUrl, [catalogEntry.owner, 'unfoldingWord', 'Door43-Catalog'], `en_${abbreviation}`, ref, stage, authToken);
    }
    if (entry) {
      subjects.push(entry.subject);
      entries.push(entry);
    }
  }
  for (let subject of requiredSubjects) {
    if (!subjects.includes(subject)) {
      let stage = catalogEntry.stage;
      let entry = await getCatalogEntryBySubject(
        apiUrl,
        subject,
        catalogEntry.language,
        [catalogEntry.owner, `${catalogEntry.language}_gl`, 'unfoldingWord', 'Door43-Catalog'],
        stage
      );
      if (entry) {
        entries.push(entry);
      }
    }
  }
  return entries;
};
