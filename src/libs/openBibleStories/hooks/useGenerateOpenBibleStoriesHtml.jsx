import { useState, useEffect } from 'react'
import convertOpenBibleStories from '../lib/openBibleStories'

export default function useGenerateOpenBibleStoriesHtml({
  catalogEntry,
  zipFileData,
  setErrorMessage,
}) {
  const [html, setHtml] = useState()

  useEffect(() => {
    if(catalogEntry && zipFileData) {
      convertOpenBibleStories(catalogEntry, zipFileData).
        then(html => setHtml(html)).
        catch(e => setErrorMessage(e.message))
    }
  }, [catalogEntry, zipFileData])
  
  return html
}