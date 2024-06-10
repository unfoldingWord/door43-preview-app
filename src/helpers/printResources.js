export const printResources = {
  webCssTemplate: `
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
  
  h1, h2, h3, h4, h5, h6,
  h1 + *, h2 + *, h3 + *, h4 + *, h5 + *, h6 + *,
  .header-title {
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

  \${webCss}
`,
  printCssTemplate: `
  @page {
    size: \${pageWidth} \${pageHeight};
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
  
  span.footnote {
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
    columns: \${columns}
  }
  
  h1 {
    break-before: avoid;
  }
    
  \${printCss}  
`,
  pageSizes: {
    // Landscape Sizes
    L: {
      A4: {
        label: 'A4',
        orientation: 'landscape',
        width: '297mm',
        height: '210mm',
      },
      USL: {
        label: 'US Letter',
        orientation: 'landscape',
        width: '11in',
        height: '8.5in',
      },
    },
    // Portrait Sizes
    P: {
      A4: {
        label: 'A4',
        orientation: 'portrait',
        width: '210mm',
        height: '297mm',
        size: 'A4',
      },
      A5: {
        label: 'A5',
        orientation: 'portrait',
        width: '148.5mm',
        height: '210mm',
        size: 'A5',
      },
      USL: {
        label: 'US Letter',
        orientation: 'portrait',
        width: '8.5in',
        height: '11in',
        size: 'letter',
      },
      TR: {
        label: 'Trade',
        orientation: 'portrait',
        width: '6in',
        height: '9in',
      },
      CQ: {
        label: 'Crown Quarto',
        orientation: 'portrait',
        width: '189mm',
        height: '246mm',
      },
    },
  },
};

export default printResources;
