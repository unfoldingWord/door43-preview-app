// React imports
import { useContext, forwardRef } from 'react';

// Library imports
import DOMPurify from 'dompurify';
import PropTypes from 'prop-types';

// Context imports
import { AppContext } from '@contexts/App.context';

// Helper libraries
import printResources from '@helpers/printResources';
import { getDoor43PrevieAppVersionFooterHTML } from '@helpers/html';

export const WebPreviewComponent = forwardRef(({ style }, ref) => {
  const {
    state: {htmlSections, cachedHtmlSections, renderOptions },
  } = useContext(AppContext);

  const sections = { ...cachedHtmlSections, ...htmlSections };

  const css = printResources.webCssTemplate.replace('${webCss}', sections?.css?.web || '');
  console.log(css);
  const cover = sections?.cover || '';
  const toc = sections?.toc || '';
  const copyright = sections?.copyright || '';
  const body = sections?.body || '';
 
  let html = '';

  if (renderOptions?.showWebCover) {
    html = `
<div class="section cover-page">
  ${cover}
</div>
<hr />
`;
  }
  if(renderOptions?.showWebCopyright) {
    html += `
<div class="section" id="copyright-page">
  ${copyright}
  ${getDoor43PrevieAppVersionFooterHTML()}
</div>
<hr />
`;
  }

  if(renderOptions?.showWebToc) {
    html += `<div class="section toc-page">
  ${toc}
</div>
<hr />
`;
  }

  html += body;
  
  return (
    <>
      <style type="text/css">{css}</style>
      <div
        id="web-preview"
        style={style}
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(html, { ADD_ATTR: ['target'] }),
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
