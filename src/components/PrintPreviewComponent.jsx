import { useState, useEffect, forwardRef } from "react";
import PropTypes from 'prop-types'
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
  if (catalogEntry.abbreviation in abbreviationToLogoMap) {
    logo = `logo-${abbreviationToLogoMap[catalogEntry.abbreviation]}-256.png`
  }
  const cover = `
  <span class="header-title"></span>
  <img class="title-logo" src="https://cdn.door43.org/assets/uw-icons/${logo}" alt="${logo}">
  <h1 class="cover-header section-header">${catalogEntry.title}</h1>
  <h3 class="cover-version">${catalogEntry.branch_or_tag_name}</h3>
  ${extra}
`
  return cover
}


function generateToc(content) {
  const elements = content.querySelectorAll(":scope > *")
  let html = ""
  elements.forEach(element => {
    const title = element.getAttribute('data-toc-title')
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
  printOptions,
  htmlSections,
  webCss,
  printCss,
  setPrintPreviewState,
  view,
}, ref) => {
  const [htmlToRender, setHtmlToRender] = useState("")
  const [cssToRender, setCssToRender] = useState("")
  const [isRendering, setIsRendering] = useState(false)

  useEffect(() => {
    const preparingForPrintPreview = async () => {
      let copyright = htmlSections.copyright || ""
      const body = htmlSections.body
      const doc = new DOMParser().parseFromString(body, "text/html")
      let toc = htmlSections.toc || ""
      if (!toc) {
        toc = `
  <h1 class="toc-header">Table of Contents</h1>
  <div id="toc-contents">
    <ul class="toc-section top-toc-section">
      ${generateToc(doc.firstChild)}
    </ul>
  </div>
`
      }
      const cover = generateCover(catalogEntry, htmlSections.cover)

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
  @bottom-center {content: none}
  @top-center {content: none}
  @top-left { content: none}
  @top-right {content: none}
}

@page :cover-page {
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
  columns: ${printOptions?.columns || "1"};
}

.header-title {
  position: running(titleRunning);
}

@media print {
  h1 {
    break-before: avoid-page;
  }

  section, 
  article {
    break-after: page;
  }

  section.toc-page,
  section.copyright-page {
    break-before: page;
  }
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

#toc-contents > ul > li > a {
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

${webCss}

${printCss}
`
      const htmlStr = `
<div id="pagedjs-print" style="direction: ${catalogEntry.language_direction}" data-direction="${catalogEntry.language_direction}">
  <section class="cover-page">
    ${cover}
  </section>
  <section id="copyright-page">
    ${copyright}
  </section>
  <section class="toc-page">
    ${toc}
  </section>
  ${doc.documentElement.innerHTML}
</div>
`
      setHtmlToRender(htmlStr)
      setCssToRender(cssStr)
    }

    if (htmlSections?.body && Object.keys(printOptions).length) {
      preparingForPrintPreview()
    }
  }, [catalogEntry, printOptions, webCss, htmlSections?.body, htmlSections.copyright, htmlSections.cover, htmlSections.toc, printCss, ref, setPrintPreviewState])

  useEffect(() => {
    const generatePrintPreview = async (htmlStr, cssStr) => {
      console.log("STARTING PRINT RENDERING")
      setPrintPreviewState("started")
      ref.current.innerHTML = ""
      const innerDiv = document.createElement('div');
      innerDiv.id = 'print-preview-inner';
      ref.current.appendChild(innerDiv);

      const previewer = new Previewer()
      previewer.preview(
        htmlStr,
        [
          {
            _: cssStr,
          },
        ],
        innerDiv,
      ).then((flow) => {
        setPrintPreviewState("rendered")
        console.log(`PRINT PREVIEW IS READY. Rendered ${flow.total} pages.`)
        setIsRendering(false)
      }).catch(e => {
        setPrintPreviewState("error")
        console.log("ERROR RENDERING PRINT PREVIEW: ", e)
      })
    }

    if (htmlToRender && cssToRender) {
      generatePrintPreview(htmlToRender, cssToRender)
      console.log("SETTING IS RENDERING TO TRUE")
      setIsRendering(true)
      setHtmlToRender("")
      setCssToRender("")
    }
  }, [htmlToRender, cssToRender, isRendering, setPrintPreviewState])

  return (
    <div id="print-preview" style={{display: (isRendering || view == "print" ? "block" : "none")}} ref={ref} />
  )
})

PrintPreviewComponent.displayName = "PrintPreviewComponent";

PrintPreviewComponent.propTypes = {
  catalogEntry: PropTypes.object,
  style: PropTypes.object,
  printOptions: PropTypes.object,
  htmlSections: PropTypes.object,
  webCss: PropTypes.string,
  printCss: PropTypes.string,
  setPrintPreviewState: PropTypes.func,
};