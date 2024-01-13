import { useState, useEffect } from 'react'
import convertTranslationAcademy from '../lib/translationAcademy'

export default function useGenerateTranslationAcademyHtml({
  catalogEntry,
  zipFileData,
}) {
  const [html, setHtml] = useState()

  useEffect(() => {
    if(catalogEntry && zipFileData) {
      convertTranslationAcademy(catalogEntry, zipFileData).
        then(html => setHtml(html))
    }
  }, [catalogEntry, zipFileData])
  
  return html
}