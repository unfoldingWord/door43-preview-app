import { useState, useEffect } from 'react'


export default function useGenerateTranslationAcademyHtml({
  catalogEntry,
  taManuals,
}) {
  const [html, setHtml] = useState()

  useEffect(() => {
    const flattenToHtml = async () => {
      const toHtml = (manual, section, index, total, depth = 1, subtitles= []) => {
        let html = ""
        if (depth > 6) {
          depth = 6
        }
        let { link, title, toctitle, body, sections = [] } = section
        if (! toctitle) {
          toctitle = title
        }
        const mySubtitles = [...subtitles]
        if (mySubtitles[mySubtitles.length-1] != toctitle) {
          mySubtitles.push(toctitle)
        }
        if (body) {
          html += `
<article id="${link}-article" class="${index == 0 ? 'first-article' : (index + 1) == total ? 'last-article' : ''}">
  ${title != manual.title ? `
  <h${depth} class="header article-header">
    <span class="header-anchor" id="${link}"></span>
    <span class="header-title">${mySubtitles.join(" :: ")}</span>
    <a href="#${link}" class="header-link">${title}</a>
  </h${depth}>
` : `
  <span class="header-anchor" id="${link}"></span>
  <span class="header-title">${mySubtitles.join(" :: ")}</span>
`}
  <div class="article-body">
    ${body}
  </div>
</article>
`
          if (index < total - 1) {
            html += `
<hr class="article-divider divider"></hr>
`
          }
        }
        if (sections && sections.length) {
          const sectionsHtml = sections.flatMap((child, index) =>
            toHtml(manual, child, index, sections.length, depth + 1, mySubtitles)
          ).join("")
          html += `
<section id="${link}-section" class="${index == 0 ? "first-section " : index == (total-1) ? "last-section " : ""}${depth == 1 ? 'manual' : 'subsection'}">
  <h${depth} class="header section-header">
    <span class="header-anchor" id="${link}"></span>
    <span class="header-title">${mySubtitles.join(" :: ")}</span>
    <a href="#${link}" class="header-link">${title}</a>
  </h${depth}>
  ${sectionsHtml}
</section>
`
        }
        return html
      }

      let html = `
<section id="cover-page">
  <span class="header-anchor" id="cover-page"></span>
  <span class="header-title"></span>
  <img class="title-logo" src="https://cdn.door43.org/assets/uw-icons/logo-uta-256.png">
  <h1 clsas="cover-header section-header">${catalogEntry.title}</h1>
</section>
`
      html += taManuals.flatMap((manual, index) => toHtml(manual, manual, index, taManuals.length)).join("")
      setHtml(html)
    }

    if (taManuals && taManuals) {
      flattenToHtml();
    }
  }, [taManuals, taManuals])
  
  return html
}
