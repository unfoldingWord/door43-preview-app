import { useState, useEffect, forwardRef } from "react";
import { Previewer } from "pagedjs";


export const PrintPreviewComponent = forwardRef(({
    style,
    html,
    show,
    printOptions,
    webCss,
    printCss,
    setPrintPreviewState,
}, ref) => {
  useEffect(() => {
    const generatePrintPreview = async () => {
      setPrintPreviewState("started")
      ref.current.innerHTML = ""
      const previewer = new Previewer()
      previewer.preview(
          html,
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

#paras {
  columns: ${printOptions.columns};
}

.header-title {
  position: running(titleRunning);
}

h1 {
  break-before: avoid;
  page-break-before: avoid;
}

section > .section-header:nth-child(1), article > .article-header:nth-child(1) {
  page-break-before: avoid;
}

section, article {
  page-break-before: always;
  break-before: always;  
}

.section-header + section, .section-header + article, .header + section, .header + article {
  page-break-before: avoid;
  break-before: avoid;
}

#cover-page {
  page: cover-page;
  padding-top: 100px;
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
  
    if (html && Object.keys(printOptions).length) {
      generatePrintPreview()
    }
  }, [html, printOptions])

  return (
    <div style={{display: show ? "block" : "none"}}>
      <div id="print-preview" style={style} ref={ref} />
    </div>
  )
})
