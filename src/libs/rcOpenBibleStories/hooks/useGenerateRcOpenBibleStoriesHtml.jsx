import { useState, useEffect } from 'react'
import convertRcOpenBibleStories from '../lib/rcOpenBibleStories'

export default function useGenerateRcOpenBibleStoriesHtml({
  catalogEntry,
  zipFileData,
}) {
  const [html, setHtml] = useState()
  console.log("HERE1")

  useEffect(() => {
    console.log("HERE2")
    if(catalogEntry && zipFileData) {
      console.log("HERE3")
      convertRcOpenBibleStories(catalogEntry, zipFileData).
        then(html => setHtml(html))
    }
  }, [catalogEntry, zipFileData])
  
  return html
}