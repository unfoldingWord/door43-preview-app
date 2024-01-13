import { useState, useEffect } from "react"
import PropTypes from "prop-types"
import { getRelationCatalogEntries } from "../lib/dcsCatalog"

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
      const response = await fetch(metadataUrl);
      if (!response.ok) {
        const text = await response.text();
        throw Error(text);
      }
      const metadata = await response.json();
      if (!metadata) {
        throw new Error("No manifest.yaml file found for this resource.");
      }

      if (!metadata?.dublin_core?.relation) {
        throw new Error(
          "There is no dublin_core.relation property in the manifest.yaml file."
        );
      }

      getRelationCatalogEntries(
        catalogApiUrl,
        metadata.dublin_core.relation,
        [catalogEntry.repo.owner.username, "unfoldingword", "door43-catalog"],
        catalogEntry.stage
      ).then((entries) => setRelationCatalogEntries(entries));
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
