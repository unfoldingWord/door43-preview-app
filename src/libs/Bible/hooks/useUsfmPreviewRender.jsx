import React, { useState, useEffect } from 'react'
import { usePkBookPreviewRenderer } from '@oce-editor-tools/base'
import { Proskomma } from 'proskomma-core'

export default function useUsfmPreviewRenderer(props) {
  const {
    bookId,
    usfmText,
    verbose, 
    extInfo, 
    renderFlags,
    htmlRender,
    renderStyles,
    setErrorMessage,
  } = props

  const [docId, setDocId] = useState()
  // eslint-disable-next-line no-unused-vars
  const [pk, setPk] = useState(new Proskomma())
  const [renderedData,setRenderedData] = useState()
  const [importedBookDocIds, setImportedBookDocIds] = useState({})

  const { ready, doRender } = usePkBookPreviewRenderer({
    pk, 
    docId, 
    bookId,
    renderStyles,
  })

  useEffect(() => {
    const importBookIntoPk= async () => {
      try {
        const res = pk.importDocument(
          {lang: 'xxx', abbr: 'XXX'}, // doesn't matter...
          "usfm",
          usfmText
        )
        if (res.id !== undefined) {
          setImportedBookDocIds({...importedBookDocIds, [bookId]: res.id})
          setDocId(res.id)
        } else {
          setErrorMessage("Failed to import book for rendering.")
        }
      } catch(e) {
        console.log(`Error calling pk.importDocument(): `, e)
        setErrorMessage("Failed to import book for rendering. See console log for details.")
      }
    }

    if ( pk && usfmText && bookId ) {
      if (! (bookId in importedBookDocIds)) {
        importBookIntoPk()
      } else {
        setDocId(importedBookDocIds[bookId])
      }
    }
  }, [pk, usfmText, bookId])

  useEffect(() => {
    if (pk && ready) {
      setRenderedData(doRender({renderFlags, extInfo, verbose, htmlRender}))
    }
  },[pk, doRender, extInfo, renderFlags, verbose, ready, htmlRender])

  return {renderedData, ready}
}
