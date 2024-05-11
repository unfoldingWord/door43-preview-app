import MarkdownIt from "markdown-it";

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
