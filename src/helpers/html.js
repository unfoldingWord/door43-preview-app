import MarkdownIt from "markdown-it";
import { getRepoContentsContent } from '@helpers/dcsApi';
import { APP_VERSION } from '@common/constants';

export function encodeHTML(s) {
  if (!s) {
    return '';
  }
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function transformRelativeUrls(htmlString, bookId) {
  // This regex:
  // 1. Matches href=" followed by optional ../ or ./ prefixes
  // 2. Excludes URLs that start with protocols (http:, https:, etc.)
  // 3. Captures the path components
  return htmlString.replace(
    /href="(?!(?:https?:|ftp:|mailto:|tel:|file:))(?:\.\.\/|\.\/)+([^"]+)"/g,
    function (match, path) {
      // Remove .md extension if present
      path = path.replace(/\.md$/, '');
      // Convert slashes to dashes
      path = path.replace(/\//g, '-');
      // Strip leading zeros
      path = path.replace(/(^|-)0+/g, '$1');
      // If first character after stripping zeros is a number (1-9), add bookId- prefix
      if (/^([1-9]+|front)/.test(path)) {
        return `href="#nav-${bookId}-${path}"`;
      }
      return `href="#nav-${path}"`;
    }
  );
}

export function convertNoteFromMD2HTML(note, bookId, chapterStr) {
  const md = new MarkdownIt();
  const noteAsProperMarkdown = note?.replace(/(\\n)+/g, '\n\n').replace(/(<br>)+/g, '\n\n').replaceAll('rc://*/', 'rc://en/') || ''; // change * to en do avoid becoming italic in Markdown
  note = md.render(noteAsProperMarkdown);
  note = note.replace(/href="\.\.\/\.\.\/([1-3]*[a-z]+)\/0*([^/".]+)\/0*([^/".]+)(\.md){0,1}"/g, `href="${window.location.href.split('#')[0].split('?')[0]}?book=$1#$1-$2-$3" target="_blank"`);
  note = note.replace(/href="\.\.\/\.\.\/([1-3]*[a-z]+)\/0*([^/".]+)(\.md){0,1}"/g, `href="${window.location.href.split('#')[0].split('?')[0]}?book=$1#$1-$2" target="_blank"`);
  // handle a single version, href="../01.md" or "01.md" or "./10"
  note = note.replace(/href="(\.+\/){0,1}0*([1-9]+)(\.md){0,1}"/g, `href="#nav-${bookId}-${chapterStr}-$2"`);
  note = transformRelativeUrls(note, bookId);
  note = note.replace(/(href="http[^"]+")/g, '$1 target="_blank"');
  note = note.replace(/<h4>/g, '<h6>').replace(/<\/h4>/g, '</h6>');
  note = note.replace(/<h3>/g, '<h5>').replace(/<\/h3>/g, '</h5>');
  note = note.replace(/<h2>/g, '<h4>').replace(/<\/h2>/g, '</h4>');
  note = note.replace(/<h1>/g, '<h3>').replace(/<\/h1>/g, '</h3>');
  // note = note.replace(/\s*\(See: \[\[[^\]]+\]\]\)/, '');

  return note;
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