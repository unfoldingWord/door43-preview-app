import { forwardRef } from "react";
import DOMPurify from 'dompurify'
import PropTypes from 'prop-types';

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
      }} ref={ref} />
    </>
  )
})

WebPreviewComponent.displayName = 'WebPreviewComponent';

WebPreviewComponent.propTypes = {
  style: PropTypes.object,
  webCss: PropTypes.string,
  html: PropTypes.string,
};
