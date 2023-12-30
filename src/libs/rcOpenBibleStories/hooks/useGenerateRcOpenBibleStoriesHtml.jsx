import { useState, useEffect } from 'react'
import convertRcOpenBibleStories from '../lib/rcOpenBibleStories'

export default function useGenerateRcOpenBibleStoriesHtml({
  catalogEntry,
  zipFileData,
}) {
  const [html, setHtml] = useState()

  useEffect(() => {
    if(catalogEntry && zipFileData) {
      convertRcOpenBibleStories(catalogEntry, zipFileData).
        then(html => setHtml(html))
    }
  }, [catalogEntry, zipFileData])
  
  return html
}