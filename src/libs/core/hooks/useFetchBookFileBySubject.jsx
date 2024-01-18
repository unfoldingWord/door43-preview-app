import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { getRepoContentsContent } from '../lib/dcsApi'


export default function useFetchBookFileBySubject({
  catalogEntries,
  bookId,
  subject,
}) {
    const [catalogEntry, setCatalogEntry] = useState()
    const [fileContents, setFileContents] = useState()

    useEffect(() => {
        const determineCatalogEntryBySubject = async () => {
          let _catalogEntry = null
          catalogEntries.forEach(entry => {
            if (!_catalogEntry && entry.subject == subject) {
              entry.ingredients.forEach(ingredient => {
                if (ingredient.identifier == bookId) {
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
      }, [catalogEntries, subject])

      useEffect(() => {
        const fetchBookFileContents = async () => {
            let filePath = ""
            catalogEntry.ingredients.forEach(ingredient => {
                if (ingredient.identifier == bookId) {
                    filePath = ingredient.path.replace(/^\./, "")
                }
            })
            if ( ! filePath ) {
              throw new Error(`The required related resource ${catalogEntry.full_name} (${catalogEntry.subject}) does not contain a project for \`${bookId}\`.`)
            }
            getRepoContentsContent(catalogEntry.repo.url, filePath, catalogEntry.branch_or_tag_name).
            then(contents => setFileContents(contents))
        }

        if(catalogEntry && bookId && catalogEntry.subject == subject) {
          fetchBookFileContents()
        }
      }, [catalogEntry, subject, bookId])

    return {fileContents, catalogEntry}
}

useFetchBookFileBySubject.propTypes = {
  relationCatalogEntries: PropTypes.arrayOf(PropTypes.object).isRequired,
  bookId: PropTypes.string.isRequired,
}
