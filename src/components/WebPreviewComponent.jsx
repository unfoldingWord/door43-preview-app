import { forwardRef } from "react";
import DOMPurify from 'dompurify'


export const WebPreviewComponent = forwardRef(({
    style,
    webCss,
    html,
}, ref) => {
  return (
    <>
      <style type="text/css">{webCss}</style>
      <div id="web-preview" style={style} dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(html, {ADD_ATTR: ['target']}),
      }} ref={ref}></div>
    </>
  )
})
