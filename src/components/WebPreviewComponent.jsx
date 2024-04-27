// React imports
import { useContext, forwardRef } from 'react';

// Library imports
import DOMPurify from 'dompurify';
import PropTypes from 'prop-types';

// Context imports
import { AppContext } from '@components/App.context';

export const WebPreviewComponent = forwardRef(({ style }, ref) => {
  const {
    state: {htmlSections, cachedHtmlSections },
  } = useContext(AppContext);

  return (
    <>
      <style type="text/css">{htmlSections?.css?.web || cachedHtmlSections?.css?.web}</style>
      <style type="text/css">{htmlSections?.css?.print || cachedHtmlSections?.css?.print}</style>
      <div
        id="web-preview"
        style={style}
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(htmlSections?.body || cachedHtmlSections?.body, { ADD_ATTR: ['target'] }),
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
