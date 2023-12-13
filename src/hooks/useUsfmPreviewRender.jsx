import React, { useState, useEffect } from 'react'
import { usePkBookPreviewRenderer } from "@oce-editor-tools/base";
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
    if (pk != null && usfmText != null && ! (bookId in importedBookDocIds)) {
      const res = pk.importDocument(
        {lang: 'xxx', abbr: 'XXX'}, // doesn't matter...
        "usfm",
        usfmText
      )
      if (res.id !== undefined) {
        importedBookDocIds[bookId] = res.id
        setImportedBookDocIds(importedBookDocIds)
      }
    }
    if (bookId in importedBookDocIds){
        setDocId(importedBookDocIds[bookId])
    }
  }, [pk, usfmText, bookId])

  useEffect(() => {
    async function doQueryPk() {
      const query = `{ documents { id bookCode: header( id: "bookCode") } }`
      const result = await pk.gqlQuerySync(query)
    }

    if (pk) {
      if (!ready) {
        try {
          doQueryPk()
        } catch (e) {
          console.log(e)
        }
      } else {
        setRenderedData(doRender({renderFlags, extInfo, verbose, htmlRender}))
      }
    }
  },[pk, doRender, extInfo, renderFlags, verbose, ready, htmlRender])

  return {renderedData, ready}
}
