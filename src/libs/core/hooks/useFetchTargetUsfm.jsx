import { useState, useEffect } from "react";
import PropTypes from 'prop-types';
import { getZipFileDataForCatalogEntry } from "../../core/lib/zip";


export default function useFetchTargetUsfm({
    relationCatalogEntries,
    bookId
}) {
    const [targetCatalogEntry, setTargetCatalogEntry] = useState()
    const [targetZipFileData, setTargetZipFileData] = useState()
    const [targetUsfm, setTargetUsfm] = useState()

    useEffect(() => {
        const fetchSourchZipFileData = async () => {
          const targetSubject = "Aligned Bible"
          let targetEntry = null
          relationCatalogEntries.forEach(entry => {
            if (!targetEntry && entry.subject == targetSubject) {
              targetEntry = entry
            }
          })
          if (!targetEntry) {
            setErrorMessage(`No relation found of subject \`${targetSubject}\` in this resource's manfest.yaml file.`)
            return
          }
          if (!targetEntry.ingredients.filter(ingredient => ingredient.identifier != bookId).length){
            setErrorMessage(`The target resource, ${targetEntry.full_name}, does not include the book \`${bookId}\`.`)
            return
          }
          setTargetCatalogEntry(targetEntry)
          setTargetZipFileData(await getZipFileDataForCatalogEntry(targetEntry))
        }
    
        if (relationCatalogEntries) {
          fetchSourchZipFileData()
        }
      }, [relationCatalogEntries])

      useEffect(() => {
        const loadTargetUsfmFile = async () => {
            let usfmFilePath = ""
            targetCatalogEntry.ingredients.forEach(ingredient => {
                if (ingredient.identifier.toLowerCase() == bookId.toLowerCase()) {
                    usfmFilePath = targetCatalogEntry.repo.name + ingredient.path.replace(/^\./, "")
                }
            })
            if ( ! (usfmFilePath in targetZipFileData.files) ) {
              throw new Error(`Target USFM file does not exist: ${usfmFilePath}`)
            }
            const usfm = await targetZipFileData.file(usfmFilePath).async('text')
            setTargetUsfm(usfm)
        }

        if(targetZipFileData && targetCatalogEntry && bookId) {
            console.log("LOADING TARGET USFM")
            loadTargetUsfmFile()
        }
      }, [targetZipFileData, targetCatalogEntry, bookId])

    return {targetUsfm, targetCatalogEntry}
}

useFetchTargetUsfm.propTypes = {
  relationCatalogEntries: PropTypes.arrayOf(PropTypes.object).isRequired,
  bookId: PropTypes.string.isRequired,
}
