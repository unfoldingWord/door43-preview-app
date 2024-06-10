import MarkdownIt from "markdown-it";
import { getRepoContentsContent } from '@helpers/dcsApi';
import { APP_VERSION } from '@common/constants';

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

export function encodeHTML(s) {
  if( ! s) {
    return '';
  }
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export function convertNoteFromMD2HTML(note, bookId, chapterStr) {
  const md = new MarkdownIt();
  note = md.render(note.replaceAll('\\n', '\n').replaceAll('<br>', '\n'));
  note = note.replace(/href="\.\/0*([^/".]+)(\.md){0,1}"/g, `href="#nav-${bookId}-${chapterStr}-$1"`);
  note = note.replace(/href="\.\.\/0*([^/".]+)\/0*([^/".]+)(\.md){0,1}"/g, `href="#nav-${bookId}-$1-$2"`);
  note = note.replace(/href="0*([^#/".]+)(\.md){0,1}"/g, `href="#nav-${bookId}-${chapterStr}-$1"`);
  note = note.replace(/href="\/*0*([^#/".]+)\/0*([^/".]+)\.md"/g, `href="#nav-${bookId}-$1-$2"`);
  note = note.replace(/(?<![">])(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*))/g, '<a href="$1">$1</a>');
  note = note.replace(/(href="http[^"]+")/g, '$1 target="_blank"');
  note = note.replace(/<h4>/g, '<h6>').replace(/<\/h4>/g, '</h6>');
  note = note.replace(/<h3>/g, '<h5>').replace(/<\/h3>/g, '</h5>');
  note = note.replace(/<h2>/g, '<h4>').replace(/<\/h2>/g, '</h4>');
  note = note.replace(/<h1>/g, '<h3>').replace(/<\/h1>/g, '</h3>');
  note = note.replace(/\s*\(See: \[\[[^\]]+\]\]\)/, '');

  return note;
}

export function generateCoverPage(catalogEntry, extraHtml) {
  let logo = `uW-app-256.png`;
  if (catalogEntry.abbreviation in abbreviationToLogoMap) {
    logo = `logo-${abbreviationToLogoMap[catalogEntry.abbreviation]}-256.png`;
  }
  const html = `
  <span class="header-title"></span>
  <img class="title-logo" src="https://cdn.door43.org/assets/uw-icons/${logo}" alt="${logo}">
  <h1 class="cover-header section-header">${catalogEntry.title}</h1>
  <h3 class="cover-version">${catalogEntry.branch_or_tag_name}</h3>
  ${extraHtml}
`;

  return html;
}

export function generateTocHtml(body) {
  const doc = new DOMParser().parseFromString(body, 'text/html');
  let html = `
<h1 class="toc-header">Table of Contents</h1>
<div id="toc-contents">
<ul class="toc-section top-toc-section">
  ${generateTocSectionHtml(doc.getElementsByTagName('body')?.[0])}
</ul>
</div>
`;
  return html;
}

function generateTocSectionHtml(topElement) {
  const elements = topElement.querySelectorAll(':scope > *');
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
    const subHtml = generateTocSectionHtml(element);
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

export async function generateCopyrightAndLicenseHTML(catalogEntry, builtWith, authToken = '') {
  let copyrightAndLicense = `<h1>Copyrights & Licensing</h1>`;

  const md = new MarkdownIt();
  try {
    copyrightAndLicense += `<div class="license">` + md.render(await getRepoContentsContent(catalogEntry.repo.url, 'LICENSE.md', catalogEntry.commit_sha, authToken)) + `</div>`;
  } catch (e) {
    console.log(`Error calling getRepoContentsContent(${catalogEntry.repo.url}, "LICENSE.md", ${catalogEntry.commit_sha}): `, e);
  }

  for (let entry of builtWith) {
    const date = new Date(entry.released);
    const formattedDate = date.toISOString().split('T')[0];
    copyrightAndLicense += `
<div style="padding-bottom: 10px">
  <div style="font-weight: bold">${entry.title}</div>
  <div><span style="font-weight: bold">Date:</span> ${formattedDate}</div>
  <div><span style="font-weight: bold">Version:</span> ${entry.branch_or_tag_name}</div>
  <div><span style="font-weight: bold">Published by:</span> ${entry.repo.owner.full_name || entry.repo.owner}</div>
</div>
`;
  }

  return copyrightAndLicense;
}

export function getDoor43PrevieAppVersionFooterHTML() {
  const date = new Date();
  const formattedDate = date.toISOString().split('T')[0];
  return `
<div id="app-version-info" style="font-size: 0.8em; display: flex; justify-content: space-between; border-top: 1px solid black; margin-top: 10px;">
  <div><span style="font-weight: bold">Generated with:</span>&nbsp;<a href="${window.location.href}" target="_blank">Door43 Preview</a></div>
  <div><span style="font-weight: bold">Version:</span> ${APP_VERSION}</div>
  <div><span style="font-weight: bold">Date:</span> ${formattedDate}</div>
</div>
`;
}