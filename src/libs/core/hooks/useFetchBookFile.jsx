import { useState, useEffect } from "react";
import { getRepoContentsContent } from "../lib/dcsApi";


export default function useFetchBookFile({
  catalogEntry,
  bookId
}) {
  const [fileContents, setFileContents] = useState();

  useEffect(() => {
    const fetchBookFileContents = async () => {
      let filePath = "";
      catalogEntry.ingredients.forEach((ingredient) => {
        if (ingredient.identifier == bookId) {
          filePath = ingredient.path.replace(/^\./, "")
        }
      });
      if (!filePath) {
        throw new Error(
          `The required related resource ${catalogEntry.full_name} (${catalogEntry.subject}) does not contain a project for \`${bookId}\`.`
        )
      }
      getRepoContentsContent(
        catalogEntry.repo.url,
        filePath,
        catalogEntry.branch_or_tag_name
      ).then((contents) => setFileContents(contents))
    };

    if (catalogEntry && bookId) {
      fetchBookFileContents()
    }
  }, [catalogEntry, bookId])

  return fileContents
}
