import { useState, useEffect, useContext, forwardRef } from 'react';
import PropTypes from 'prop-types';
import * as Paged from 'pagedjs';
import { AppContext } from '@components/App.context';
import { getDoor43PrevieAppVersionFooterHTML } from '@helpers/html';

function generateCover(catalogEntry, extra) {
  const abbreviationToLogoMap = {
    ta: 'uta',
    tn: 'utn',
    tq: 'utq',
    tw: 'utw',
    ult: 'ult',
    ust: 'ust',
    glt: 'ult',
    gst: 'ust',
    obs: 'obs',
    'obs-sn': 'obs',
    'obs-sq': 'obs',
    'obs-tn': 'obs',
    'obs-tq': 'obs',
  };
  let logo = `uW-app-256.png`;
  if (catalogEntry.abbreviation in abbreviationToLogoMap) {
    logo = `logo-${abbreviationToLogoMap[catalogEntry.abbreviation]}-256.png`;
  }
  const cover = `
  <span class="header-title"></span>
  <img class="title-logo" src="https://cdn.door43.org/assets/uw-icons/${logo}" alt="${logo}">
  <h1 class="header cover-header section-header">${catalogEntry.title}</h1>
  <h3 class="cover-version">${catalogEntry.branch_or_tag_name}</h3>
  ${extra}
`;
  return cover;
}

function generateToc(content) {
  const elements = content.querySelectorAll(':scope > *');
  let html = '';
  elements.forEach((element) => {
    const title = element.getAttribute('data-toc-title');
    if (title && element.id) {
      //       html += `
      // <li class="toc-entry">
      //   <a class="toc-element" href="#print-${element.id}"><span class="toc-element-title">${title}</span></a>
      // </li>
      // `
      html += `
<li class="toc-entry">
  <a class="toc-element" href="#${element.id}"><span class="toc-element-title">${title}</span></a>
</li>
`;
    }
    const subHtml = generateToc(element);
    if (subHtml) {
      if (title) {
        html += `
<ul class="toc-section">
  ${subHtml}
</ul>
`;
      } else {
        html += subHtml;
      }
    }
  });
  return html;
}

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
      let copyright = htmlSections?.copyright || '';
      const body = htmlSections?.body || cachedHtmlSections?.body || '';
      const doc = new DOMParser().parseFromString(body, 'text/html');
      let toc = htmlSections?.toc || `
  <h1 class="header toc-header">Table of Contents</h1>
  <div id="toc-contents">
    <ul class="toc-section top-toc-section">
      ${generateToc(doc.getElementsByTagName('body')?.[0])}
    </ul>
  </div>
`;
      const cover = generateCover(catalogEntry, htmlSections.cover);

      const cssStr = `
@page {
  size: ${printOptions.pageWidth} ${printOptions.pageHeight};
  margin: 1cm;

  @footnote {
    float: bottom;
    border-top: black 1px solid;
    padding-top: 2mm;
    font-size: 8pt;
  }

  @bottom-center {
    content: counter(page);
  }
}

@page :first {
  @bottom-center {
    content: none;
  }
}

@page :blank {
  @bottom-center {
    content: none;
  }

  @top-center {
    content: none;
  }

  @top-left {
    content: none;
  }

  @top-right {
    content: none;
  }
}

@page :cover-page {
  @bottom-center {
    content: none;
  }

  @top-center {
    content: none;
  }

  @top-left {
    content: none;
  }

  @top-right {
    content: none;
  }
}

@page :left {
  margin-right: 30mm;
  margin-left: 20mm;

  @top-left {
    font-size: 10px;
    content: element(titleRunning);
    text-align: left;
  }
}

@page :right {
  margin-left: 30mm;
  margin-right: 20mm;

  @top-right {
    font-size: 10px;
    content: element(titleRunning);
    text-align: right;
  }
}

span.paras_usfm_f {
  float: footnote;
  position: note(footnotes);
}

::footnote-call {
  /* content: counter(footnote, lower-alpha); */
  font-weight: 700;
  font-size: 1em;
  line-height: 0;
}

::footnote-marker {
  /* content: counter(footnote, lower-alpha) ". "; */
  font-weight: 700;
  line-height: 0;
  font-style: italic !important;
}

.pagedjs_footnote_area * {
  background-color: white !important;
}

a.footnote {
  font-style: italic !important;
}

.header-title {
  position: running(titleRunning);
}

.pagedjs_pages .section.bible-book {
  columns: ${printOptions?.columns || 1}
}

h1 {
  break-before: avoid;
}

.section,
.article {
  break-after: page !important;
}

.section.toc-page,
.section.copyright-page {
  break-before: page;
}

.cover-page,
.title-page {
  page: cover-page;
  padding-top: 100px;
}

#toc {
  font-size: 12px;
}

#toc h1 {
  text-align: center;
  font-size: 1.6em;
}

#toc-contents ul {
  list-style: none;
  padding: 0;
  padding-inline-start: 0;
}

#toc-contents ul ul {
  padding-left: 10px;
}

[data-direction="rtl"] #toc-contents ul ul {
  padding-left: 0;
  padding-right: 10px;
}

#toc-contents ul li {
  width: 100%;
  list-style-type: none;
  padding-bottom: 2px;
  line-height: 1.1em;
}

#toc-contents ul a {
  display: inline-block;
  width: 100%;
  border-bottom: 2px dotted #555555;
  text-decoration: none;
  color: #000 !important;
  /* margin-left: 20px;
    text-indent: -20px; */
}

#toc-contents>ul>li>a {
  font-weight: bold;
}

#toc-contents ul a span {
  background-color: white;
  margin: 0 25px 0 0;
  padding: 0 2px 3px 0;
}

[data-direction="rtl"] #toc-contents ul a span {
  margin: 0 0 0 25px;
  padding: 0 0 3px 2px;
}

#toc-contents ul a::after {
  position: absolute;
  right: 0;
  content: target-counter(attr(href), page);
  background-color: white;
  padding-bottom: 4px;
  padding-left: 2px;
  padding-right: 10px;
}

[data-direction="rtl"] #toc-contents ul a::after {
  left: 0 !important;
  right: auto !important;
  padding-right: 2px;
  padding-left: 30px;
}

h1 {
  font-size: 1.6em;
}

h1, h2, h3, h4, h5, h6 {
  break-after: avoid;
  page-break-after: avoid;
}

.header-title {
  display: none;
}

.cover-page {
  text-align: center;
}

.section,
.article {
  break-after: page !important;
}

.section {
  break-before: page !important;
}

.section > .section:first-child {
  break-before: auto !important;
}

.header + * {
  break-before: auto !important;
}

${htmlSections?.css?.web || cachedHtmlSections?.css?.web || ''}

${htmlSections?.css?.print || cachedHtmlSections?.css?.print || ''}
`;
      const htmlStr = `
<div id="pagedjs-print" style="direction: ${catalogEntry.language_direction}" data-direction="${catalogEntry.language_direction}">
  <div class="section cover-page">
    ${cover}
  </div>
  <div class="section" id="copyright-page">
    ${copyright}
    ${getDoor43PrevieAppVersionFooterHTML()}
  </div>
  <div class="section toc-page">
    ${toc}
  </div>
  ${doc.getElementsByTagName('body')?.[0]?.innerHTML}
</div>
`;

      const count = estimatePageCount(ref, htmlStr, cssStr, printOptions.pageHeight, printOptions.pageWidth);
      console.log(`Estimated page count: ${count}`);
      setEstimatedPageCount(count);
      setHtmlToRender(htmlStr);
      setCssToRender(cssStr);
      setPagedJsReadyHtml(`
      <html>
        <head>
          <title>${catalogEntry.title} - ${catalogEntry.branch_or_tag_name}${bookTitle && bookTitle != catalogEntry.title && ` - ${bookTitle}`} (${catalogEntry.full_name})</title>
          <script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"></script>
          <style>
      ${cssStr}
          </style>
        </head>
        <body>
      ${htmlStr}
        </body>
      </html>`)
    };

    if ((htmlSections?.body || cachedHtmlSections?.body) && Object.keys(printOptions).length) {
      prepareForPrintPreview();
    }
  }, [catalogEntry, htmlSections, cachedHtmlSections, printOptions, ref]);

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
