import { useState, useEffect, useContext, forwardRef } from 'react';
import PropTypes from 'prop-types';
import * as Paged from 'pagedjs';
import { AppContext } from '@contexts/App.context';
import { getDoor43PrevieAppVersionFooterHTML } from '@helpers/html';
import printResources from '@helpers/printResources';

const estimatePageCount = (ref, html, css, pageHeighInMMStr, pageWidthInMMStr) => {
  const pageHeightInMM = parseFloat(pageHeighInMMStr || '297mm');
  const pageHeight = pageHeightInMM * 2.83465;
  const pageWidthInMM = parseFloat(pageWidthInMMStr || '210mm');
  const pageWidth = pageWidthInMM * 2.83465;
  const iframe = document.createElement('iframe');
  iframe.style.width = pageWidth + 'px';
  iframe.style.height = '100%';
  iframe.style.visibility = 'hidden';
  ref.current.appendChild(iframe);
  iframe.contentDocument.body.innerHTML = `<style>${css}</style>${html}`;
  const scrollHeight = iframe.contentDocument.body.scrollHeight;
  ref.current.removeChild(iframe);
  return Math.ceil((scrollHeight / pageHeight) * 1.13);
};

export const PrintPreviewComponent = forwardRef(({ style, view }, ref) => {
  const {
    state: { catalogEntry, bookTitle, htmlSections, printOptions, cachedHtmlSections },
    actions: { setPrintPreviewStatus, setPrintPreviewPercentDone, setPagedJsReadyHtml },
  } = useContext(AppContext);

  const [htmlToRender, setHtmlToRender] = useState('');
  const [cssToRender, setCssToRender] = useState('');
  const [estimatedPageCount, setEstimatedPageCount] = useState(0);

  useEffect(() => {
    const prepareForPrintPreview = async () => {
      const cover = htmlSections?.cover || cachedHtmlSections?.cover || '';
      const toc = htmlSections?.toc || cachedHtmlSections?.toc || '';
      const copyright = htmlSections?.copyright || cachedHtmlSections?.copyright || '';
      const body = htmlSections?.body || cachedHtmlSections?.body || '';
      const webCss = htmlSections?.css?.web || cachedHtmlSections?.css?.web || '';
      const printCss = htmlSections?.css?.print || cachedHtmlSections?.css?.print || '';

      const css = printResources.webCssTemplate.replace('${webCss}', webCss) + 
        printResources.printCssTemplate.replace('${printCss}', printCss).
        replace('${pageWidth}', printOptions.pageWidth).
        replace('${pageHeight}', printOptions.pageHeight).
        replace('${columns}', printOptions?.columns || 1);

      let html = `
<div id="pagedjs-print" style="direction: ${catalogEntry.language_direction}" data-direction="${catalogEntry.language_direction}">
`;
      if(!printOptions?.hideCover) {
        html += `
  <div class="section cover-page">
    ${cover}
  </div>
`;
      }

      if(!printOptions?.hideCopyright) {
        html += `
  <div class="section" id="copyright-page">
    ${copyright}
    ${getDoor43PrevieAppVersionFooterHTML()}
  </div>
`;
      }

      if(!printOptions?.hideToc) {
        html += `
  <div class="section toc-page">
    ${toc}
  </div>
`;
      }

      html += `
  ${body}
</div>
`;

      console.log(html);
      const count = estimatePageCount(ref, html, css, printOptions.pageHeight, printOptions.pageWidth);
      console.log(`Estimated page count: ${count}`);
      setEstimatedPageCount(count);
      setHtmlToRender(html);
      setCssToRender(css);
      setPagedJsReadyHtml(`
      <html>
        <head>
          <title>${catalogEntry.title} - ${catalogEntry.branch_or_tag_name}${bookTitle && bookTitle != catalogEntry.title && ` - ${bookTitle}`} (${catalogEntry.full_name})</title>
          <script src="https://unpkg.com/pagedjs/dist/paged.polyfilllllllll.js"></script>
          <style>
      ${css}
          </style>
        </head>
        <body>
      ${html}
        </body>
      </html>`)
    };

    if ((htmlSections?.body || cachedHtmlSections?.body) && Object.keys(printOptions).length) {
      prepareForPrintPreview();
    }
  }, [catalogEntry, htmlSections, cachedHtmlSections, printOptions, ref, bookTitle, setPagedJsReadyHtml]);

  useEffect(() => {
    const renderPrintPreview = async () => {

      const styleTags = document.querySelectorAll('style[data-pagedjs-inserted-styles]');
      styleTags.forEach((tag) => tag.remove());

      ref.current.innerHTML = '';
      const innerDiv = document.createElement('div');
      innerDiv.id = 'print-preview-inner';
      ref.current.appendChild(innerDiv);

      class PrintPreviewHandler extends Paged.Handler {
        constructor(chunker, polisher, caller) {
          super(chunker, polisher, caller);
        }

        afterPageLayout(page) {
          const pageNum = parseInt(page.getAttribute('data-page-number'));
          let percentDone = Math.round((pageNum / (estimatedPageCount > pageNum ? estimatedPageCount : pageNum)) * 100);
          if (percentDone >= 100) {
            percentDone = 99;
          }
          setPrintPreviewPercentDone(percentDone);
        }

        afterRendered() {
          setPrintPreviewPercentDone(100);
        }
      }

      const previewer = new Paged.Previewer();
      previewer.registerHandlers(PrintPreviewHandler);

      console.log(htmlToRender);
      console.log(cssToRender);

      previewer
        .preview(
          htmlToRender,
          [
            {
              _: cssToRender,
            },
          ],
          innerDiv
        )
        .then((flow) => {
          setPrintPreviewStatus('ready');
          console.log(`PRINT PREVIEW IS READY. Rendered ${flow.total} pages.`);
        })
        .catch((e) => {
          setPrintPreviewStatus('aborted');
          console.log('ERROR RENDERING PRINT PREVIEW: ', e);
        });
    }

    const rect = ref?.current?.getBoundingClientRect();
    const isVisible = rect && rect.top < window.innerHeight && rect.bottom >= 0;
    if (isVisible && htmlToRender && cssToRender) {
      setPrintPreviewStatus('rendering');
      renderPrintPreview();
    }
  }, [ref, htmlToRender, cssToRender, estimatedPageCount, setPrintPreviewPercentDone, setPrintPreviewStatus]);

  return <div id="print-preview" style={{ ...style, display: view != 'print' ? 'none' : 'block' }} ref={ref} />;
});

PrintPreviewComponent.displayName = 'PrintPreviewComponent';

PrintPreviewComponent.propTypes = {
  style: PropTypes.object,
  view: PropTypes.string,
};
