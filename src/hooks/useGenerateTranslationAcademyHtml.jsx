import { useState, useEffect } from 'react';
import { encodeHTML } from '@helpers/html';

export default function useGenerateTranslationAcademyHtml({ catalogEntry, taManuals }) {
  const [html, setHtml] = useState();

  useEffect(() => {
    const flattenToHtml = async () => {
      const toHtml = (manual, section, index, total, depth = 1, subtitles = []) => {
        let html = '';
        if (depth > 6) {
          depth = 6;
        }
        let { link, title, toctitle, body, sections = [] } = section;
        if (! title) {
          title = "NO TITLE FOUND!"
        }
        if (!toctitle) {
          toctitle = title;
        }
        const mySubtitles = [...subtitles];
        if (mySubtitles[mySubtitles.length - 1] != toctitle) {
          mySubtitles.push(toctitle);
        }
        if (body) {
          html += `
<article id="ta-${link}" data-nav-id="${link}" class="${index == 0 ? 'first-article' : index + 1 == total ? 'last-article' : ''}" data-toc-title="${encodeHTML(toctitle)}">
  ${
    title != manual.title
      ? `
  <h${depth} class="header article-header">
    <a href="#ta-${link}" data-nav-anchor="${link}" class="header-link">${title}</a>
  </h${depth}>
`
      : ``
  }
  <span class="header-title">${mySubtitles.join(' :: ')}</span>
  <div class="article-body">
    ${body}
  </div>
</article>
`;
          if (index < total - 1) {
            html += `
<hr class="article-divider divider"></hr>
`;
          }
        }
        if (sections && sections.length) {
          const sectionsHtml = sections.flatMap((child, index) => toHtml(manual, child, index, sections.length, depth + 1, mySubtitles)).join('');
          html += `
<section id="${link}" class="${index == 0 ? 'first-section ' : index == total - 1 ? 'last-section ' : ''}${depth == 1 ? 'manual' : 'subsection'}" data-toc-title="${encodeHTML(
            toctitle
          )}">
  <h${depth} class="header section-header">
    <a href="#ta-${link}" data-nav-anchor="${link}" class="header-link">${title}</a>
  </h${depth}>
  <span class="header-title">${mySubtitles.join(' :: ')}</span>
  ${sectionsHtml}
</section>
`;
        }
        return html;
      };

      const html = taManuals.flatMap((manual, index) => toHtml(manual, manual, index, taManuals.length)).join('');
      setHtml(html);
    };

    if (taManuals && taManuals) {
      flattenToHtml();
    }
  }, [catalogEntry, taManuals, setHtml]);

  return html;
}
