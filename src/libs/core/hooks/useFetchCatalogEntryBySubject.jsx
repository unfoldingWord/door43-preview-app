import { useState, useEffect } from "react";


export default function useFetchCatalogEntryBySubject({
  catalogEntries,
  subject,
  bookId,
  setErrorMessage,
}) {
    const [catalogEntry, setCatalogEntry] = useState()

    useEffect(() => {
        const determineCatalogEntryBySubject = () => {
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
            setErrorMessage(`No relation found of subject \`${subject}\` for this resource for book \`${bookId}\`.`)
            return
          }
          setCatalogEntry(_catalogEntry)
        }
    
        if (catalogEntries && subject) {
          determineCatalogEntryBySubject()
        }
      }, [catalogEntries, subject, bookId])

    return catalogEntry
}
