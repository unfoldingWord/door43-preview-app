import { useState, useEffect, useContext } from 'react';
import { getRelationCatalogEntries } from '@helpers/dcsCatalog';
import { AppContext } from '@components/App.context';

export default function useFetchRelationCatalogEntries({ catalogEntry, requiredSubjects }) {
  const [relationCatalogEntries, setRelationCatalogEntries] = useState();
  const {
    state: { authToken },
    actions: { setErrorMessage }
  } = useContext(AppContext);

  useEffect(() => {
    const fetchRelationEntries = async () => {
      const catalogApiUrl = catalogEntry?.url.match(/^(.*\/catalog)\/entry\//)?.[1];
      if (!catalogApiUrl) {
        console.log(`Not a valid catalog entry`);
        setErrorMessage('Catalog entry is invalid');
        return;
      }
      const metadataUrl = `${catalogApiUrl}/metadata/${catalogEntry.owner}/${catalogEntry.repo.name}/${catalogEntry.branch_or_tag_name}`;
      fetch(metadataUrl, {
        cache: 'default',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      })
        .then((response) => {
          if (!response.ok) {
            console.log(`Bad response from DCS for ${metadataUrl}: `, response);
            setErrorMessage(`Bad response from DCS for ${metadataUrl}`);
            return;
          }
          return response.json();
        })
        .then((metadata) => {
          if (!metadata) {
            console.log('No metadata found for this resource');
            setErrorMessage('No metadata found for this resource.');
            return;
          }
          if (!metadata?.dublin_core?.relation) {
            console.log('There is no dublin_core.relation property in the manifest.yaml file.');
            setErrorMessage('There is no dublin_core.relation property in the manifest.yaml file.');
            return;
          }
          console.log(requiredSubjects);
          if (requiredSubjects.includes('Greek New Testament')) {
            metadata.dublin_core.relation.push('el-x-koine/ugnt');
          }
          if (requiredSubjects.includes('Hebrew Old Testament')) {
            metadata.dublin_core.relation.push('hbo/uhb');
          }
          console.log(metadata.dublin_core.relation);
          return getRelationCatalogEntries(catalogEntry, metadata.dublin_core.relation, requiredSubjects, authToken);
        })
        .then((entries) => {
          setRelationCatalogEntries(entries);
        })
        .catch((e) => {
          console.log(`Failed getting metadata ${metadataUrl}:`, e);
          setErrorMessage(`Failed getting metadata ${metadataUrl}`);
        });
    };

    if (catalogEntry) {
      fetchRelationEntries();
    }
  }, [catalogEntry, requiredSubjects, authToken, setErrorMessage]);

  return relationCatalogEntries;
}
