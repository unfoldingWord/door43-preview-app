import { useState, useEffect } from "react";
import PropTypes from 'prop-types';
import { BIBLE_BOOKS } from "../../../common/BooksOfTheBible.js";
import { getZipFileDataForCatalogEntry } from "../../core/lib/zip";


export default function useFetchSourceUsfm({
  relationCatalogEntries,
  bookId,
}) {
    const [sourceCatalogEntry, setSourceCatalogEntry] = useState()
    const [sourceZipFileData, setSourceZipFileData] = useState()
    const [sourceUsfm, setSourceUsfm] = useState()

    useEffect(() => {
        const fetchSourchZipFileData = async () => {
          let sourceSubject = ""
          if (bookId in BIBLE_BOOKS.oldTestament) {
            sourceSubject= "Hebrew Old Testament"
          } else {
            sourceSubject = "Greek New Testament"
          }
          let sourceEntry = null
          relationCatalogEntries.forEach(entry => {
            if (!sourceEntry && entry.subject == sourceSubject) {
              sourceEntry = entry
            }
          })
          if (!sourceEntry) {
            setErrorMessage(`No relation found of subject \`${sourceSubject}\` in this resource's manfest.yaml file.`)
            return
          }
          if (!sourceEntry.ingredients.filter(ingredient => ingredient.identifier != bookId).length){
            setErrorMessage(`The source resource, ${sourceEntry.full_name}, does not include the book \`${bookId}\`.`)
            return
          }
          setSourceCatalogEntry(sourceEntry)
          setSourceZipFileData(await getZipFileDataForCatalogEntry(sourceEntry))
        }
    
        if (relationCatalogEntries) {
          fetchSourchZipFileData()
        }
      }, [relationCatalogEntries])

      useEffect(() => {
        const loadSourceUsfmFile = async () => {
            let usfmFilePath = ""
            sourceCatalogEntry.ingredients.forEach(ingredient => {
                if (ingredient.identifier.toLowerCase() == bookId.toLowerCase()) {
                    usfmFilePath = sourceCatalogEntry.repo.name + ingredient.path.replace(/^\./, "")
                }
            })
            if ( ! (usfmFilePath in sourceZipFileData.files) ) {
              throw new Error(`Source USFM file does not exist: ${usfmFilePath}`)
            }
            const usfm = await sourceZipFileData.file(usfmFilePath).async('text')
            setSourceUsfm(usfm)
        }

        if(sourceZipFileData && sourceCatalogEntry && bookId) {
          console.log("LOADING SOURCE USFM")
          loadSourceUsfmFile()
        }
      }, [sourceZipFileData, sourceCatalogEntry, bookId])

    return {sourceUsfm, sourceCatalogEntry}
}

useFetchSourceUsfm.propTypes = {
  relationCatalogEntries: PropTypes.arrayOf(PropTypes.object).isRequired,
  bookId: PropTypes.string.isRequired,
}
