// React imports
import { useContext, forwardRef } from 'react';

// Library imports
import DOMPurify from 'dompurify';
import PropTypes from 'prop-types';

// Context imports
import { AppContext } from '@components/App.context';

export const WebPreviewComponent = forwardRef(({ style }, ref) => {
  const {
    state: { webCss, printCss, htmlSections, cachedHtmlSection },
  } = useContext(AppContext);

  return (
    <>
      <style type="text/css">{webCss + printCss}</style>
      <div
        id="web-preview"
        style={style}
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(htmlSections?.body || cachedHtmlSection?.body, { ADD_ATTR: ['target'] }),
        }}
        ref={ref}
      />
    </>
  );
});

WebPreviewComponent.displayName = 'WebPreviewComponent';

WebPreviewComponent.propTypes = {
  style: PropTypes.object,
};
