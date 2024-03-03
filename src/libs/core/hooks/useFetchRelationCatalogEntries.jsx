import { useState, useEffect } from 'react'
import { getRelationCatalogEntries } from '../lib/dcsCatalog'

export default function useFetchRelationCatalogEntries({
  catalogEntry,
  setErrorMessage,
}) {
  const [relationCatalogEntries, setRelationCatalogEntries] = useState()

  useEffect(() => {
    const fetchRelationEntries = async () => {
      const catalogApiUrl = catalogEntry?.url.match(/^(.*\/catalog)\/entry\//)?.[1]
      if (!catalogApiUrl) {
        console.log(`Not a valid catalog entry`)
        setErrorMessage("Catalog entry is invalid")
        return
      }
      const metadataUrl = `${catalogApiUrl}/metadata/${catalogEntry.owner}/${catalogEntry.repo.name}/${catalogEntry.branch_or_tag_name}`
      fetch(metadataUrl, {cache: "no-cache"}).
        then(response => {
          if (!response.ok) {
            console.log(`Bad response from DCS for ${metadataUrl}: `, response)
            setErrorMessage(`Bad response from DCS for ${metadataUrl}`)
            return
          }
          return response.json()
        }).then(metadata => {
          if (!metadata) {
            console.log("No metadata found for this resource")
            setErrorMessage("No metadata found for this resource.")
            return
          }
          if (!metadata?.dublin_core?.relation) {
            console.log("There is no dublin_core.relation property in the manifest.yaml file.")
            setErrorMessage("There is no dublin_core.relation property in the manifest.yaml file.")
            return
          }
          return getRelationCatalogEntries(
            catalogApiUrl,
            metadata.dublin_core.relation,
            [catalogEntry.repo.owner.username, "unfoldingword", "door43-catalog"],
            catalogEntry.stage
          )
        }).then(entries => setRelationCatalogEntries(entries)).
        catch(e => {
          console.log(`Failed getting metadata ${metadataUrl}:`, e)
          setErrorMessage(`Failed getting metadata ${metadataUrl}`)
        })
    }

    if (catalogEntry) {
      fetchRelationEntries()
    }
  }, [catalogEntry])

  return relationCatalogEntries
}
