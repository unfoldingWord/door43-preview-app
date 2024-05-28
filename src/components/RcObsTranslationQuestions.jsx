// React imports
import { useState, useEffect, useContext, useMemo } from 'react';

// Material UI
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material';

// Bible reference imports
import BibleReference, {useBibleReference} from 'bible-reference-rcl';

// Context imports
import { AppContext } from '@components/App.context';

// Hook imports
import useFetchRelationCatalogEntries from '@hooks/useFetchRelationCatalogEntries';
import useFetchCatalogEntriesBySubject from '@hooks/useFetchCatalogEntriesBySubject';
import usePivotTsvFileOnReference from '@hooks/usePivotTsvFileOnReference';
import useFetchBookFiles from '@hooks/useFetchBookFiles';
import useFetchZipFileData from '../hooks/useFetchZipFileData';
import useGetOBSData from '../hooks/useGetOBSData';

// Helper imports
import { convertNoteFromMD2HTML } from '@helpers/html';
import { generateCopyrightAndLicenseHTML } from '@helpers/html';
import { getOBSImgURL } from '@helpers/obs_helpers';

const theme = createTheme({
  overrides: {
    MuiInput: {
      '*': {
        borderBottom: '2px solid red',
      },
    },
  },
});

const webCss = `
.tq-question {
  font-weight: bold;
}

.tq-entry h1 {
  font-size: 1.4em;
  margin: 10px 0;
}

.tq-entry h2 {
  font-size: 1.2em;
  margin: 10px 0;
}

.tq-entry h3, .tq-entry h4 {
  font-size: 1.1em;
  margin: 10px 0;
}

.article.tq-scripture,
.article.tq-entry,
.section.tq-frame {
  break-before: auto !important;
  break-inside: avoid !important;
  break-after: auto !important
}

.section.book-story {
  break-after: page !important;
}

a.header-link {
  font-weight: inherit !important;
  font-size: inherit !important;
  color: #000000;
  text-decoration: none;
}

a.header-link:hover::after {
  content: "#";
  padding-left: 5px;
  color: blue;
  display: inline-block;
}

.tq-entry {
  margin-left: 30px;
}

#web-preview h4.tq-entry-question {
  display:inline-block;
}

#web-preview label.response-show-label {
  margin-left: 20px;
  display: inline-box;
}

.response-show-checkbox {
  display: none;
}

#web-preview .response-show-checkbox ~ div.tq-entry-response {
  display: none;
  clear: both;
  margin-bottom: 20px;
}

#web-preview .response-show-checkbox:checked ~ div.tq-entry-response {
  display: block;
}

#web-preview label.response-show-label::after {
  background-color: white;
  border-right: 3px solid black;
  border-bottom: 3px solid black;
  width: 10px;
  display: inline-block;
  height: 10px;
  transform: rotate(45deg);
  -webkit-transform: scale(1) rotate(45deg) translate(0px, 0px);
  -moz-transform: rotate(45deg) scale(1.0);
  -o-transform: rotate(45deg) scale(1.0);
  margin-top: 10px;
  content: "";
  margin-left: 5px;
}

#web-preview .response-show-checkbox:checked ~ label.response-show-label::after {
  border-right: 3px solid black;
  border-bottom: 3px solid black;
  transform: rotate(-135deg);
  -webkit-transform: scale(1) rotate(-135deg) translate(0px, 0px);
  -moz-transform: rotate(-135deg) scale(1.0);
  -o-transform: rotate(-135deg) scale(1.0);
}

.tq-scripture-block {
  border: 1px solid black;
  padding: 10px;
  margin-bottom: 10px;
}

.tq-scripture-header {
  margin: 0;
}

.tq-scripture-text {
  font-style: italic;
}

.tq-story-section {
  break-after: page !important;
}

.tq-story-frame-section {
  break-after: auto !important;
  page-break-after: auto !important;
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}

`;

const requiredSubjects = ['Open Bible Stories'];

export default function RcObsTranslationQuestions() {
  const {
    state: { urlInfo, catalogEntry, bookId, bookTitle, navAnchor, authToken, builtWith },
    actions: { setBookId, setSupportedBooks, setStatusMessage, setErrorMessage, setHtmlSections, setNavAnchor, setCanChangeColumns, setBuiltWith },
  } = useContext(AppContext);

  const [html, setHtml] = useState();
  const [copyright, setCopyright] = useState();
  const [imageResolution, setImageResolution] = useState('none');

  const renderFlags = {
    showWordAtts: false,
    showTitles: true,
    showHeadings: true,
    showIntroductions: true,
    showFootnotes: false,
    showXrefs: false,
    showParaStyles: true,
    showCharacterMarkup: false,
    showChapterLabels: true,
    showVersesLabels: true,
  };

  const onBibleReferenceChange = (b, c, v) => {
    if (setNavAnchor) {
      let anchorParts = [b];
      if (c != '1' || v != '1') {
        anchorParts.push(c);
      }
      if (v != '1') {
        anchorParts.push(v);
      }
      setNavAnchor(anchorParts.join('-'));
    }
  };

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: 'obs',
    initialChapter: urlInfo.hashParts[1] || '1',
    initialVerse: urlInfo.hashParts[2] || '1',
    onChange: onBibleReferenceChange,
    addOBS: true,
  });

  const relationCatalogEntries = useFetchRelationCatalogEntries({
    catalogEntry,
    requiredSubjects,
    setErrorMessage,
    bookId,
    authToken,
  });

  const catalogEntries = useMemo(() => catalogEntry ? [catalogEntry] : [], [catalogEntry]);

  const tqTsvBookFiles = useFetchBookFiles({
    catalogEntries,
    bookId: 'obs',
    setErrorMessage,
  });

  const tqTsvData = usePivotTsvFileOnReference({
    tsvBookFile: tqTsvBookFiles?.[0],
  });

  const obsCatalogEntries = useFetchCatalogEntriesBySubject({
    catalogEntries: relationCatalogEntries,
    subject: 'Open Bible Stories',
    bookId: 'obs',
    firstOnly: true,
    setErrorMessage,
  });

  const obsZipFileData = useFetchZipFileData({
    catalogEntry: obsCatalogEntries?.[0],
    authToken,
  });

  const obsData = useGetOBSData({ catalogEntry: obsCatalogEntries?.[0], zipFileData: obsZipFileData, setErrorMessage });

  useEffect(() => {
    if (catalogEntry && obsCatalogEntries.length) {
      setBuiltWith([
        catalogEntry,
        ...(obsCatalogEntries?.[0] ? [obsCatalogEntries[0]] : [])
      ])
    }
  }, [ catalogEntry, obsCatalogEntries, setBuiltWith])


  useEffect(() => {
    const setInitialBookIdAndSupportedBooks = async () => {
      let sb = ['obs']
      setSupportedBooks(sb);
      bibleReferenceActions.applyBooksFilter(sb);
      setBookId('obs');
      setHtmlSections((prevState) => {return {...prevState, css: {web: webCss, print: ''}}});
      setCanChangeColumns(false);

      if (!catalogEntry) {
        // setErrorMessage('No catalog entry for this resource found.');
        return;
      }

      setStatusMessage(
        <>
          Preparing preview for {catalogEntry.title}.
          <br />
          Please wait...
        </>
      );
    };

    setInitialBookIdAndSupportedBooks();
  }, [urlInfo, catalogEntry, authToken, setBookId, setStatusMessage, setErrorMessage, setHtmlSections, setCanChangeColumns, setSupportedBooks]);

  useEffect(() => {
    if (navAnchor && ! navAnchor.includes('--')) {
      const parts = navAnchor.split('-');
      if (bibleReferenceState.bookId == parts[0] && (bibleReferenceState.chapter != (parts[1] || '1') || bibleReferenceState.verse != (parts[2] || '1'))) {
        bibleReferenceActions.goToBookChapterVerse(parts[0], parts[1] || '1', parts[2] || '1');
      }
    }
  }, [navAnchor]);

  useEffect(() => {
    const generateHtml = async () => {
      let html = `
<div class="section tq-book-section" id="nav-${bookId}" data-toc-title="${catalogEntry.title} - ${bookTitle}">
  <h1 class="header tq-book-section-header"><a href="#nav-${bookId}" class="header-link">${bookTitle}</a></h1>
`;
      if (tqTsvData?.front?.intro) {
        html += `
      <div class="section tq-front-intro-section" data-toc-title="${bookTitle} Introduciton">
`;
        for (let row of tqTsvData?.front?.intro || []) {
          html += `
        <div class="tq-front-intro-note">
          <span class="header-title">${catalogEntry.title} :: ${bookTitle} :: Introduction</span>
          <div class="tq-question-body">
            ${convertNoteFromMD2HTML(row.Question, bookId, 'front')}
            ${convertNoteFromMD2HTML(row.Response, bookId, 'front')}
          </div>
        </div>
`;
        }
      html += `
      </div>
`;
      }
      for (let storyIdx = 0; storyIdx < 50; storyIdx++) {
        const storyStr = String(storyIdx + 1);
        html += `
      <div id="nav-${bookId}-${storyStr}" class="section tq-story-section" data-toc-title="${obsData.stories[storyIdx].title}">
        <h2 class="tq-story-header"><a href="#nav-${bookId}-${storyStr}" class="header-link">${obsData.stories[storyIdx].title}</a></h2>
`;
        if (tqTsvData?.[storyStr]?.['intro']) {
          html += `
      <div class="section tq-story-intro-section">
`;
          for (let row of tqTsvData[storyStr]['intro']) {
            const link = `nav-${bookId}-${storyStr}-intro-${row.ID}`;
            const article = `
        <div class="article" id="${link}">
          <span class="header-title">${catalogEntry.title} :: Introduction</span>
          ${convertNoteFromMD2HTML(row.Note, bookId, storyStr)}
        </div>
`;
            html += article;
          }
          html += `
      </div>
`;
        }

        for (let frameIdx = 0; frameIdx < obsData.stories[storyIdx].frames.length; frameIdx++) {
          const frameStr = String(frameIdx + 1);
          const frameLink = `nav-${bookId}-${storyStr}-${frameStr}`;
          html += `
      <div id="${frameLink}" class="section tq-story-frame-section">
        <h3 class="tq-frame-header"><a href="#${frameLink}" class="header-link">${storyStr}:${frameStr}</a></h3>
        <span class="header-title">${catalogEntry.title} :: ${storyStr}:${frameStr}</span>
`;
        if (imageResolution != 'none') {
          html += `
        <div class="obs-image-container" style="text-align: center">
         <img src="${await getOBSImgURL({ storyNum: storyStr, frameNum: frameStr, resolution: imageResolution })}" alt="Frame ${storyStr}-${frameStr}">
        </div>
`;
      }

          html += `
        <div class="tq-frame-text">
          ${obsData.stories[storyIdx].frames[frameIdx].content}
        </div>
`;
          if (tqTsvData?.[storyStr]?.[frameStr]) {
            for (let rowIdx in tqTsvData[storyStr][frameStr]) {
              const row = tqTsvData[storyStr][frameStr][rowIdx];
              const questionLink = `nav-${bookId}-${storyStr}-${frameStr}-${row.ID}`;
              if (row.Question) {
                let article = `
              <div id="${questionLink}" class="tq-question-article">
                <div class="tq-entry">
                  <h4 class="tq-entry-question">
                    <a class="header-link" href="#${questionLink}">
                      ${row.Question}
                    </a>
                  </h4>
`;
                if (row.Response) {
                  article += `
                  <input type="checkbox" class="response-show-checkbox" id="checkbox-${row.ID}" style="display:none;">
                  <label class="response-show-label" for="checkbox-${row.ID}"></label>
                  <div class="tq-entry-response">
                    ${convertNoteFromMD2HTML(row.Response, bookId, storyStr)}
                  </div>
`;
                }
                article += `
                </div>
              </div>
`;
                html += article;
              }
            }
          } else {
            html += `
          <div class="tq-frame-no-content">
            (There are no questions for this frame)
          </div>
`;
          }
          html += `
    </div>
`;
        }
        html += `
  </div>
`;
      }

      html += `
</div>
`;
      setHtml(html);
    };

    if (obsData && Object.keys(tqTsvData).length) {
      generateHtml();
    }
  }, [
    catalogEntry,
    obsData,
    tqTsvBookFiles,
    tqTsvData,
    imageResolution,
    bookId,
    bookTitle,
    setHtmlSections,
    setStatusMessage,
    setErrorMessage,
    setNavAnchor,
  ]);

  useEffect(() => {
    const generateCopyrightPage = async () => {
      const copyrightAndLicense = await generateCopyrightAndLicenseHTML(
        catalogEntry,
        builtWith,
        authToken,
      )
      setCopyright(copyrightAndLicense);
    };

    if (catalogEntry && builtWith.length) {
      generateCopyrightPage();
    }
  }, [catalogEntry, builtWith, authToken, setCopyright]);


  useEffect(() => {
    if (html && copyright) {
      setHtmlSections((prevState) => ({
        ...prevState,
        cover: `<h3>${bookTitle}</h3>`,
        copyright,
        body: html,
      }));
    }
  }, [html, copyright, bookTitle, setHtmlSections]);

  return (
    <ThemeProvider theme={theme}>
      <BibleReference status={bibleReferenceState} actions={bibleReferenceActions} style={{ minWidth: 'auto' }} />
      <FormControl>
        <InputLabel id="image-resolution-label">Images</InputLabel>
        <Select labelId="image-resolution-label" label="Images" value={imageResolution} onChange={(event) => setImageResolution(event.target.value)}>
          <MenuItem value="none">Hide Images</MenuItem>
          <MenuItem value="360px">640x360px</MenuItem>
          <MenuItem value="2160px">3840x2160px</MenuItem>
        </Select>
      </FormControl>
    </ThemeProvider>
  )
}
