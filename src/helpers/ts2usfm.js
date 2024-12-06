import { BibleBookData } from '@common/books';

export async function ts2usfm(catalogEntry, ingredient, zipFileData) {
  const bookId = ingredient?.identifier?.toLowerCase();
  if (!(bookId in BibleBookData)) {
    return '';
  }
  const chapters = BibleBookData[bookId].chapters;
  let usfm = '';
  if (chapters) {
    let bookTitle;
    const frontTitlePath = `${catalogEntry.name}/front/title.txt`;
    const zeroTitlePath = `${catalogEntry.name}/00/title.txt`;
    if (frontTitlePath in zipFileData.files) {
      bookTitle = await zipFileData.file(frontTitlePath).async('text');
    } else if (zeroTitlePath in zipFileData.files) {
      bookTitle = await zipFileData.file(zeroTitlePath).async('text');
    } else {
      bookTitle = ingredient.title;
    }

    usfm = `
\\id ${bookId.toUpperCase()} ${catalogEntry.title}
\\usfm 3.0
\\ide UTF-8
\\h ${bookTitle}
\\toc1 ${bookTitle}
\\toc2 ${bookTitle}
\\toc3 ${bookTitle}
\\mt ${bookTitle}

`;
    for (const chapterIdx in chapters) {
      const chapter = chapterIdx + 1;
      const numVerses = chapters[chapterIdx];
      for (let verse = 1; verse <= numVerses; verse++) {
        const verseFilePath = `${catalogEntry.name.toLowerCase()}/${String(chapter).padStart(2, '0')}/${String(verse).padStart(2, '0')}.txt`;
        if (verseFilePath in zipFileData.files) {
          let text = await zipFileData.file(verseFilePath).async('text');
          if (verse == 1 && !new RegExp(`\\c ${chapter}`).test(text)) {
            text = `\\c ${chapter}\n${text}`;
          }
          usfm += `\\p\n${text}\n`;
        }
      }
    }
  }
  return usfm;
}
