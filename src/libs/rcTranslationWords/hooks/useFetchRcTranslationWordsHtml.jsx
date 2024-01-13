import { useState } from 'react'
import convertOpenBibleStories from '../libraries/openBibleStories'
import useFetchZipFileData from '../../core/hooks/useFetchZipFileData'

export default function useFetchTranslationWordsHtml({
  catalogEntry,
  setErrorMessage,
}) {
  const [html, setHtml] = useState()

  const zipFileData = useFetchZipFileData({catalogEntry})

  useEffect(() => {
    const generateRcTranslatoinWordsHtml = async () => {
        convertOpenBibleStories(catalogEntry, zipFileData).
            then(html => setHtml(html)).
            catch(e => setErrorMessage(e.message))
    }

    if(zipFileData) {
      generateRcTranslatoinWordsHtml()
    }

    return html
  }, [zipFileData])
}