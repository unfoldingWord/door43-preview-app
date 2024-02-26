import { useState, useEffect } from "react";


export default function useFetchCatalogEntryBySubject({
  catalogEntries,
  subject,
  bookId,
}) {
    const [catalogEntry, setCatalogEntry] = useState()

    useEffect(() => {
        const determineCatalogEntryBySubject = async () => {
          let _catalogEntry = null
          catalogEntries.forEach(entry => {
            if (!_catalogEntry && entry.subject == subject) {
              entry.ingredients.forEach(ingredient => {
                if (!bookId || ingredient.identifier == bookId) {
                  _catalogEntry = entry
                }
              })
            }
          })
          if (!_catalogEntry) {
            throw new Error(`No relation found of subject \`${sourceSubject}\` for this resource for book \`${bookId}\`.`)
          }
          setCatalogEntry(_catalogEntry)
        }
    
        if (catalogEntries && subject) {
          determineCatalogEntryBySubject()
        }
      }, [catalogEntries, subject, bookId])

    return catalogEntry
}
