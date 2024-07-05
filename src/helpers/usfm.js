import { UsfmFileConversionHelpers } from 'word-aligner-rcl';
import usfm from 'usfm-js';

const flattenChapterData = (chapterData) => {
  let usfmStr = '';

  if ("front" in chapterData) {
    usfmStr += UsfmFileConversionHelpers.getUsfmForVerseContent(chapterData["front"]);
  }
  Object.keys(chapterData).forEach((verseNum) => {
    if (verseNum === "front") {
      return;
    }
    const verseData = chapterData[verseNum];
    usfmStr += `\\v ${verseNum} ` + UsfmFileConversionHelpers.getUsfmForVerseContent(verseData);
  });

  return usfmStr;
}

export const removeAlignments = (_usfmText) => {
  const usfmJSON = usfm.toJSON(_usfmText);
  let usfmStr = '';

  usfmJSON.headers.forEach(header => {
    if (header.type == "text") {
      usfmStr += `${header.text}\n`;
    } else if (header.tag && header.content) {
      if (header.content !== "\\*") {
        header.content = ` ${header.content}`;
      }
      usfmStr += `\\${header.tag}${header.content}\n`;
    }
  })

  if ("front" in usfmJSON.chapters) {
    usfmStr += flattenChapterData(usfmJSON.chapters["front"]);
  }
  Object.keys(usfmJSON.chapters).forEach(chapterNum => {
    if (chapterNum === "front") {
      return;
    }
    usfmStr += `\n\\c ${chapterNum}\n` + flattenChapterData(usfmJSON.chapters[chapterNum]);
  });

  return usfmStr;
}
