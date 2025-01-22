import { UsfmFileConversionHelpers } from 'word-aligner-rcl';
import usfm from 'usfm-js';

const sortKeys = (keys) => {
  return keys.sort((a, b) => {
    const numA = parseInt(a.split('-')[0], 10);
    const numB = parseInt(b.split('-')[0], 10);

    if (isNaN(numA) && isNaN(numB)) {
      // Both are NaN, sort lexicographically
      return a.localeCompare(b);
    } else if (isNaN(numA)) {
      // Only numA is NaN, numA should come after numB
      return 1;
    } else if (isNaN(numB)) {
      // Only numB is NaN, numB should come after numA
      return -1;
    } else {
      // Both are numbers, sort numerically
      return numA - numB;
    }
  })
};

const flattenChapterData = (chapterData) => {
  let usfmStr = '';

  if ("front" in chapterData) {
    usfmStr += UsfmFileConversionHelpers.getUsfmForVerseContent(chapterData["front"]);
  }
  
  const sortedKeys = sortKeys(Object.keys(chapterData));

  sortedKeys.forEach((verseNum) => {
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
