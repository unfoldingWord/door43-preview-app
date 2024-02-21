import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { getRelationCatalogEntries } from '../lib/dcsCatalog'

export default function useFetchRelationCatalogEntries({
  catalogEntry
}) {
  const [relationCatalogEntries, setRelationCatalogEntries] = useState()

  useEffect(() => {
    const fetchRelationEntries = async () => {
      const catalogApiUrl = catalogEntry?.url.match(/^(.*\/catalog)\/entry\//)?.[1]
      if (!catalogApiUrl) {
        throw new Error("Catalog entry is invalid")
      }
      const metadataUrl = `${catalogApiUrl}/metadata/${catalogEntry.owner}/${catalogEntry.repo.name}/${catalogEntry.branch_or_tag_name}`;
      fetch(metadataUrl).
        then(response => {
          if (!response.ok) {
            throw Error(`Bad response from DCS for ${metadataUrl}`)
          }
          response.json()
        }).then(metadata => {
          if (!metadata) {
            throw new Error("No manifest.yaml file found for this resource.");
          }
          if (!metadata?.dublin_core?.relation) {
            throw new Error("There is no dublin_core.relation property in the manifest.yaml file.");
          }
          getRelationCatalogEntries(
            catalogApiUrl,
            metadata.dublin_core.relation,
            [catalogEntry.repo.owner.username, "unfoldingword", "door43-catalog"],
            catalogEntry.stage
          )
        }).then(entries => setRelationCatalogEntries(entries)).
        catch(e => {
          console.log(`Failed getting metadata ${metadataUrl}:`, e)
          throw(e)
        })
    }

    if (catalogEntry) {
      fetchRelationEntries()
    }
  }, [catalogEntry])

  return { relationCatalogEntries }
}

useFetchRelationCatalogEntries.propTypes = {
  catalogEntry: PropTypes.object,
}
