import { useState, useEffect, forwardRef } from "react";
import { Previewer } from "pagedjs";


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
    "obs-sn": 'obs',
    "obs-sq": 'obs',
    "obs-tn": 'obs',
    "obs-tq": 'obs',
  }
  let logo = `uW-app-256.png`
  if (abbreviationToLogoMap.hasOwnProperty(catalogEntry.abbreviation)) {
    logo = `logo-${abbreviationToLogoMap[catalogEntry.abbreviation]}-256.png`
  }
  const cover = `
<section class="cover-page" id="cover-page">
  <span class="header-title"></span>
  <img class="title-logo" src="https://cdn.door43.org/assets/uw-icons/${logo}">
  <h1 clsas="cover-header section-header">${catalogEntry.title}
  <h3 class="cover-version">${catalogEntry.branch_or_tag_name}</h3>
  ${extra}
</section>  
`
  return cover
}


function generateToc(content) {
  const elements = content.querySelectorAll(":scope > *")
  let html = ""
  elements.forEach(element => {
    const title = element.getAttribute('data-toc-title')
    if (title) {
      html += `
<li class="toc-entry">
  <a class="toc-element" href="#${element.id}"><span class="toc-element-title">${title}</span></a>
</li>
`
    }
    const subHtml = generateToc(element)
    if (subHtml) {
      if (title) {
        html += `
<ul class="toc-section">
  ${subHtml}
</ul>
`
      } else {
        html += subHtml
      }
    }
  })
  return html
}

export const PrintPreviewComponent = forwardRef(({
  catalogEntry,
  style,
  printOptions,
  htmlSections,
  webCss,
  printCss,
  setPrintPreviewState,
  webPreviewRef,
}, ref) => {
  useEffect(() => {
    const generatePrintPreview = async () => {
      setPrintPreviewState("started")
      ref.current.innerHTML = ""
      let copyright = htmlSections.copyright || ""
      let toc = htmlSections.toc || ""
      if (!toc) {
        toc = `
<section id="toc" class="toc">
  <h1 class="toc-header">Table of Contents</h1>
  <div id="toc-contents">
  <ul class="toc-section top-toc-section">
    ${generateToc(webPreviewRef.current)}
  </ul>
</section>
`
      }
      const cover = generateCover(catalogEntry, htmlSections.cover)
      const body = htmlSections.body || ""
      const previewer = new Previewer()
      previewer.preview(
        `
${cover}
${copyright}
${toc}
<section id="body">
${body}
</section>
`,
        [
          {
            _: `
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

@page :blank, @page :cover-page {
  @bottom-center {content: none}
  @top-center {content: none}
  @top-left { content: none}
  @top-right {content: none}
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

section.bible-book {
  columns: ${printOptions.columns};
}

.header-title {
  position: running(titleRunning);
}

h1 {
  break-before: avoid;
  page-break-before: avoid;
}

section, article {
  page-break-before: always;
  break-before: always;  
}


section > :first-child, article > :first-child {
  page-break-before: avoid !important;
}

section > section:first-of-type, section > article:first-of-type {
  page-break-before: avoid !important;
}

.section-header + section, .section-header + article, .header + section, .header + article {
  page-break-before: avoid;
  break-before: avoid;
}

.cover-page {
  page: cover-page;
  padding-top: 100px;
}



@media print {
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

[dir="rtl"] #toc-contents ul ul {
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
#toc-contents > ul > li > a {
    font-weight: bold;
}
#toc-contents ul a span {
    background-color: white;
    margin: 0 25px 0 0;
    padding: 0 2px 3px 0;
}

[dir="rtl"] #toc-contents ul a span {
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

[dir="rtl"] #toc-contents ul a::after {
    left: 0 !important;
    right: auto !important;
    padding-right: 2px;
    padding-left: 30px;
}
}

h1 {
  font-size: 1.6em;
}


${webCss}

${printCss}
`,
          },
        ],
        ref.current,
      ).then((flow) => {
        setPrintPreviewState("rendered")
        console.log(`PRINT PREVIEW IS READY. Rendered ${flow.total} pages.`)
      }).catch(e => {
        setPrintPreviewState("error")
        console.log("ERROR RENDERING PRINT PREVIEW: ", e)
      })
    }

    if (webPreviewRef?.current?.innerHTML && htmlSections?.body && Object.keys(printOptions).length) {
      generatePrintPreview()
    }
  }, [webPreviewRef?.current?.innerHTML, htmlSections?.body, printOptions])

  return (
    <div id="print-preview" style={style} ref={ref} />
  )
})
