import MarkdownIt from "markdown-it";
import { getRepoContentsContent } from '@helpers/dcsApi';
import { APP_VERSION } from '@common/constants';

export function encodeHTML(s) {
  if( ! s) {
    return '';
  }
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export function convertNoteFromMD2HTML(note, prefix, bookId, chapterStr) {
  const md = new MarkdownIt();
  note = md.render(note.replaceAll('\\n', '\n').replaceAll('<br>', '\n'));
  note = note.replace(/href="\.\/0*([^/".]+)(\.md){0,1}"/g, `href="#${prefix}-${bookId}-${chapterStr}-$1" data-nav-anchor="${bookId}-${chapterStr}-$1"`);
  note = note.replace(/href="\.\.\/0*([^/".]+)\/0*([^/".]+)(\.md){0,1}"/g, `href="#${prefix}-${bookId}-$1-$2" data-nav-anchor="${bookId}-$1-$2"`);
  note = note.replace(/href="0*([^#/".]+)(\.md){0,1}"/g, `href="#${prefix}-${bookId}-${chapterStr}-$1" data-nav-anchor="${bookId}-${chapterStr}-$1"`);
  note = note.replace(/href="\/*0*([^#/".]+)\/0*([^/".]+)\.md"/g, `href="#${prefix}-${bookId}-$1-$2" data-nav-anchor="${bookId}-$1-$2"`);
  note = note.replace(/(?<![">])(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*))/g, '<a href="$1">$1</a>');
  note = note.replace(/(href="http[^"]+")/g, '$1 target="_blank"');
  note = note.replace(/<h4>/g, '<h6>').replace(/<\/h4>/g, '</h6>');
  note = note.replace(/<h3>/g, '<h5>').replace(/<\/h3>/g, '</h5>');
  note = note.replace(/<h2>/g, '<h4>').replace(/<\/h2>/g, '</h4>');
  note = note.replace(/<h1>/g, '<h3>').replace(/<\/h1>/g, '</h3>');
  note = note.replace(/\s*\(See: \[\[[^\]]+\]\]\)/, '');

  return note;
}

export async function generateCopyrightAndLicenseHTML(catalogEntry, builtWith, authToken = '') {
  let copyrightAndLicense = `<h1>Copyrights and Licenceing</h1>`;

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
  <div><span style="font-weight: bold">Generated with:</span> <a href="${window.location.href}" target="_blank">Door43 Preview App</a></div>
  <div><span style="font-weight: bold">Version:</span> ${APP_VERSION}</div>
  <div><span style="font-weight: bold">Date:</span> ${formattedDate}</div>
</div>
`;
}