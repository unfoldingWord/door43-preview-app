import { useState, useEffect } from 'react';
import { getRelationCatalogEntries } from '../helpers/dcsCatalog';

export default function useFetchRelationCatalogEntries({ catalogEntry, requiredSubjects, setErrorMessage, authToken }) {
  const [relationCatalogEntries, setRelationCatalogEntries] = useState();

  useEffect(() => {
    const fetchRelationEntries = async () => {
      const catalogApiUrl = catalogEntry?.url.match(/^(.*\/catalog)\/entry\//)?.[1];
      if (!catalogApiUrl) {
        console.log(`Not a valid catalog entry`);
        setErrorMessage('Catalog entry is invalid');
        return;
      }
      const metadataUrl = `${catalogApiUrl}/metadata/${catalogEntry.owner}/${catalogEntry.repo.name}/${catalogEntry.branch_or_tag_name}${authToken?`?token=${authToken}`:''}`;
      fetch(metadataUrl, { cache: 'default' })
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
          return getRelationCatalogEntries(catalogEntry, metadata.dublin_core.relation, requiredSubjects);
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
