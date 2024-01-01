import { useState, useEffect } from 'react'
import convertOpenBibleStories from '../lib/openBibleStories'

export default function useGenerateOpenBibleStoriesHtml({
  catalogEntry,
  zipFileData,
}) {
  const [html, setHtml] = useState()

  useEffect(() => {
    if(catalogEntry && zipFileData) {
      convertOpenBibleStories(catalogEntry, zipFileData).
        then(html => setHtml(html))
    }
  }, [catalogEntry, zipFileData])
  
  return html
}