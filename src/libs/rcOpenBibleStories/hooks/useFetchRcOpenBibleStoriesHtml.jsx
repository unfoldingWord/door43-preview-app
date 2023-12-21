import { useState } from 'react'
import convertRcOpenBibleStories from '../libraries/rcOpenBibleStories'
import useFetchZipFileData from '../../core/hooks/useFetchZipFileData'

export default function useFetchRcOpenBibleStoriesHtml({
  catalogEntry,
  setErrorMessage,
}) {
  const [html, setHtml] = useState()

  const zipFileData = useFetchZipFileData({catalogEntry})

  useEffect(() => {
    const useFetchRcOpenBibleStoriesHtml = async () => {
        convertRcOpenBibleStories(catalogEntry, zipFileData).
            then(html => setHtml(html)).
            catch(error => setErrorMessage(error?.message))
    }

    if(zipFileData) {
      useFetchRcOpenBibleStoriesHtml()
    }
    return html
  }, [zipFileData])
}