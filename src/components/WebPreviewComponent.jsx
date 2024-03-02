import React, { useState, useEffect, forwardRef } from "react";
import DOMPurify from 'dompurify'


export const WebPreviewComponent = forwardRef(({
    style,
    webCss,
    html,
}, ref) => {
  const [processedHtml, setProcessedHtml] = useState("")

  useEffect(() => {
    if (html) {
      const doc = new DOMParser().parseFromString(html, "text/html")
      doc.querySelectorAll('[id]').forEach(e => e.id = `web-${e.id}`)
      setProcessedHtml(doc.documentElement.innerHTML)
    }
  }, [html])

  return (
    <>
      <style type="text/css">{webCss}</style>
      <div id="web-preview" style={style} dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(processedHtml, {ADD_ATTR: ['target']}),
      }} ref={ref} />
    </>
  )
})
