import { useContext, forwardRef } from "react";
import DOMPurify from 'dompurify'
import PropTypes from 'prop-types';
import { AppContext } from "./App.context";

export const WebPreviewComponent = forwardRef(({
    style,
}, ref) => {
  const {
    state: {
      webCss,
      printCss,
      htmlSections,
    }
  } = useContext(AppContext)

  return (
    <>
      <style type="text/css">{webCss + printCss}</style>
      <div id="web-preview" style={style} dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(htmlSections?.body, {ADD_ATTR: ['target']}),
      }} ref={ref} />
    </>
  )
})

WebPreviewComponent.displayName = 'WebPreviewComponent';

WebPreviewComponent.propTypes = {
  style: PropTypes.object,
};
