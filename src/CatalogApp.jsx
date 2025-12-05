import { useState, useEffect } from 'react'
import Header from './components/Header'
import { ResourcesCardGrid } from './components/ResourcesCardGrid'
import CatalogEntriesGrid from './components/CatalogEntriesGrid'
import './App.css'

/**
 * Lightweight catalog/home page app
 * Handles: /, /en, /u/owner
 * Shows searchable project catalog
 */
function CatalogApp() {
  const [urlInfo, setUrlInfo] = useState({ owner: '', lang: '' })

  useEffect(() => {
    const url = new URL(window.location.href)
    let urlParts = url.pathname.replace(/^\/(.*)\/*$/, '$1').split('/')
    
    let info = { owner: '', lang: '' }
    
    if (urlParts.length > 1 && urlParts[0] === 'u') {
      // /u/owner format
      info.owner = urlParts[1] || ''
    } else if (urlParts.length === 1 && urlParts[0] && urlParts[0] !== 'u') {
      // /en format (language)
      info.lang = urlParts[0]
    }
    
    setUrlInfo(info)
  }, [])

  return (
    <div className="App">
      <Header />
      <main style={{ padding: '2rem' }}>
        {urlInfo.owner ? (
          <ResourcesCardGrid owner={urlInfo.owner} />
        ) : (
          <CatalogEntriesGrid languageId={urlInfo.lang || 'en'} />
        )}
      </main>
    </div>
  )
}

export default CatalogApp
