export const getCatalogEntryByRef = async (apiUrl, owners = ['unfoldingWord', 'Door43-Catalog'], repo, ref = 'master', stage = 'prod') => {
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
      let resp = await fetch(`${apiUrl}/catalog/entry/${owner}/${r}/${ref}`);
      if (resp && resp.status == '200') {
        const json = await resp.json();
        return json;
      }
    }
  }
  // Didn't find a ref in the catalog entries of owners, so now find catalog entry of latest tag
  if (stage != 'latest') {
    for (let owner of owners) {
      for (let r of repos) {
        let resp = await fetch(`${apiUrl}/repos/${owner}/${r}`);
        if (resp && resp.status == '200') {
          const repoObj = resp.json();
          if (repoObj?.catalog?.prod) {
            resp = await fetch(`${apiUrl}/catalog/entry/${owner}/${repo}/${repoObj.branch_or_tag_name}`);
            if (resp && resp.status == '200') {
              return await resp.json();
            }
          }
        }
      }
    }
  }
  // Now we just get the latest catalog entry for the repo if it exists
  for (let owner of owners) {
    let resp = await fetch(`${apiUrl}/repos/${owner}/${repo}`);
    if (resp) {
      const repoObj = resp.json();
      if (repoObj?.catalog?.latest) {
        resp = await fetch(`${apiUrl}/catalog/entry/${owner}/${repo}/${repoObj.branch_or_tag_name}`);
        if (resp) {
          return await resp.json();
        }
      }
    }
  }
};

export const getCatalogEntryBySubject = async (apiUrl, subject, lang, owners = ['unfoldingWord', 'Door43-Catalog'], stage = 'prod') => {
  let stages = [stage];
  if (stage != 'latest') {
    stages.push('latest');
  }
  for (let s of stages) {
    for (let owner of owners) {
      let resp = await fetch(
        `${apiUrl}/catalog/search?owner=${encodeURIComponent(owner)}&stage=${encodeURIComponent(s)}&subject=${encodeURIComponent(subject)}&lang=${encodeURIComponent(lang)}`
      );
      if (resp) {
        const entries = await resp.json();
        if (entries?.data?.length > 0) {
          return entries.data[0];
        }
      }
    }
  }
};

export const getRelationCatalogEntries = async (catalogEntry, relation, requiredSubjects = []) => {
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
      stage = 'latest';
    }
    let entry = await getCatalogEntryByRef(apiUrl, [catalogEntry.owner, `${lang}_gl`, 'unfoldingWord', 'Door43-Catalog'], repo, ref, stage);
    if (!entry) {
      // Try getting English fallback
      entry = await getCatalogEntryByRef(apiUrl, [catalogEntry.owner, 'unfoldingWord', 'Door43-Catalog'], `en_${abbreviation}`, ref, stage);
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
