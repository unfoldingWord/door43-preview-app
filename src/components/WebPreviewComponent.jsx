// React imports
import { useContext, forwardRef, useEffect, useRef } from 'react';

// Library imports
import DOMPurify from 'dompurify';
import PropTypes from 'prop-types';

// Context imports
import { AppContext } from '@components/App.context';

export const WebPreviewComponent = forwardRef(({ style }, ref) => {
  const {
    state: {htmlSections, cachedHtmlSections },
  } = useContext(AppContext);

  const containerRef = useRef(null);
  const isRenderingRef = useRef(false);

  useEffect(() => {
    const html = htmlSections?.webView || htmlSections?.body || cachedHtmlSections?.body;
    
    if (!html || !containerRef.current || isRenderingRef.current) return;

    // For large HTML (>5MB), use requestIdleCallback to render without blocking
    if (html.length > 5000000) {
      isRenderingRef.current = true;
      
      // Show loading indicator
      containerRef.current.innerHTML = '<div style="padding: 20px; text-align: center;">Loading content...</div>';
      
      // Use requestIdleCallback to render during browser idle time
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          if (containerRef.current) {
            containerRef.current.innerHTML = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
            isRenderingRef.current = false;
          }
        }, { timeout: 2000 });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.innerHTML = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
            isRenderingRef.current = false;
          }
        }, 0);
      }
    } else {
      // Normal rendering for smaller HTML
      containerRef.current.innerHTML = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
    }
  }, [htmlSections?.body, htmlSections?.webView, cachedHtmlSections?.body]);

  return (
    <>
      <style type="text/css">{htmlSections?.css?.web || cachedHtmlSections?.css?.web}</style>
      <style type="text/css">{htmlSections?.css?.print || cachedHtmlSections?.css?.print}</style>
      <div
        id="web-preview"
        style={style}
        ref={(node) => {
          containerRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
      />
    </>
  );
});

WebPreviewComponent.displayName = 'WebPreviewComponent';

WebPreviewComponent.propTypes = {
  style: PropTypes.object,
};
