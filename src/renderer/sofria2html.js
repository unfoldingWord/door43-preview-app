import { render } from 'proskomma-json-tools';

const builtin = render.sofria2web.sofria2html.renderers;

const renderers = {
  ...builtin,
  text: (text) =>
    text
      .replace(/{/g, '<span class="implied-word"><span class="implied-word-start">{</span><span class="implied-word-text">')
      .replace(/}/g, '</span><span class="implied-word-end">}</span></span>'),
  chapter: '0',
  chapter_label(number) {
    this.chapter = number;
    return `<span id="chapter-${this.chapter}" class="marks_chapter_label">${number}</span>`;
  },
  verses_label(number) {
    return `<span id="chapter-${this.chapter}-verse-${number}" class="marks_verses_label">${number}</span>`;
  },
  startChapters: () => '',
  endChapters: () => '',
};

export { renderers };
