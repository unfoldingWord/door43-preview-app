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
.sq-question {
  font-weight: bold;
}

.sq-entry h1 {
  font-size: 1.4em;
  margin: 10px 0;
}

.sq-entry h2 {
  font-size: 1.2em;
  margin: 10px 0;
}

.sq-entry h3, .sq-entry h4 {
  font-size: 1.1em;
  margin: 10px 0;
}

.article.sq-scripture,
.article.sq-entry,
.section.sq-verse {
  break-before: auto !important;
  break-inside: avoid !important;
  break-after: auto !important
}

.section.book-chapter {
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

.sq-entry {
  margin-left: 30px;
}

#web-preview h4.sq-entry-question {
  display:inline-block;
}

#web-preview label.response-show-label {
  margin-left: 20px;
  display: inline-box;
}

.response-show-checkbox {
  display: none;
}

#web-preview .response-show-checkbox ~ div.sq-entry-response {
  display: none;
  clear: both;
  margin-bottom: 20px;
}

#web-preview .response-show-checkbox:checked ~ div.sq-entry-response {
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

.sq-scripture-block {
  border: 1px solid black;
  padding: 10px;
  margin-bottom: 10px;
}

.sq-scripture-header {
  margin: 0;
}

.sq-scripture-text {
  font-style: italic;
}

.sq-chapter-intro-section *, .sq-chapter-frame-section * {
  break-inside: avoid !important;
}
`;

const requiredSubjects = ['Open Bible Stories'];

export default function RcObsStudyQuestions() {
  const {
    state: { urlInfo, catalogEntry, bookTitle, navAnchor, authToken, builtWith, renderNewCopy },
    actions: { setSupportedBooks, setStatusMessage, setErrorMessage, setHtmlSections, setNavAnchor, setCanChangeColumns, setBuiltWith },
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
    initialChapter: parseInt(urlInfo.hashParts[1]) || 1,
    initialVerse: parseInt(urlInfo.hashParts[2]) || 1,
    onChange: onBibleReferenceChange,
    addOBS: true,
  });

  const relationCatalogEntries = useFetchRelationCatalogEntries({
    catalogEntry,
    requiredSubjects,
    bookId: 'obs',
  });

  const catalogEntries = useMemo(() => catalogEntry ? [catalogEntry] : [], [catalogEntry]);

  const sqTsvBookFiles = useFetchBookFiles({
    catalogEntries,
    bookId: 'obs',
    canFetch: renderNewCopy,
  });

  const sqTsvData = usePivotTsvFileOnReference({
    tsvBookFile: sqTsvBookFiles?.[0],
  });

  const obsCatalogEntries = useFetchCatalogEntriesBySubject({
    catalogEntries: relationCatalogEntries,
    subject: 'Open Bible Stories',
    bookId: 'obs',
    firstOnly: true,
  });

  const obsZipFileData = useFetchZipFileData({
    catalogEntry: obsCatalogEntries?.[0],
  });

  const obsData = useGetOBSData({ catalogEntry: obsCatalogEntries?.[0], zipFileData: obsZipFileData });

  useEffect(() => {
    if (catalogEntry && obsCatalogEntries.length) {
      setBuiltWith([
        catalogEntry, 
        ...(obsCatalogEntries?.[0] ? [obsCatalogEntries[0]] : [])
      ]);
    }
  }, [ catalogEntry, obsCatalogEntries, setBuiltWith])


  useEffect(() => {
    const setInitialBookIdAndSupportedBooks = async () => {
      let sb = ['obs']
      setSupportedBooks(sb);
      bibleReferenceActions.applyBooksFilter(sb);

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
  }, [urlInfo, catalogEntry, setStatusMessage, setErrorMessage, setHtmlSections, setCanChangeColumns, setSupportedBooks]);

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
<div class="section sq-book-section" id="nav-obs" data-toc-title="${catalogEntry.title} - ${bookTitle}">
  <h1 class="header sq-book-section-header"><a href="#nav-obs" class="header-link">${bookTitle}</a></h1>
`;
      if (sqTsvData?.front?.['0']) {
        html += `
      <div class="section sq-front-intro-section" data-toc-title="${bookTitle} Introduciton">
`;
        for (let row of sqTsvData.front['0'] || []) {
          html += `
        <div class="sq-front-intro-note">
          <span class="header-title">${catalogEntry.title} :: ${bookTitle} :: Introduction</span>
          <div class="sq-question-body">
            ${convertNoteFromMD2HTML(row.Question, 'obs', 'front')}
            ${convertNoteFromMD2HTML(row.Response, 'obs', 'front')}
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
      <div id="nav-obs-${storyStr}" class="section obs-sn-chapter-section" data-toc-title="${obsData.stories[storyIdx].title}">
        <h2 class="header obs-sn-chapter-header"><a href="#nav-obs-${storyStr}" class="header-link">${obsData.stories[storyIdx].title}</a></h2>
`;
        if (sqTsvData?.[storyStr]?.['intro']) {
          html += `
      <div class="section sq-chapter-intro-section">
`;
          for (let row of sqTsvData[storyStr]['intro']) {
            const link = `nav-obs-${storyStr}-intro-${row.ID}`;
            const article = `
        <div class="article" id="${link}">
          <span class="header-title">${catalogEntry.title} :: Introduction</span>
          ${convertNoteFromMD2HTML(row.Note, 'obs', storyStr)}
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
          const frameLink = `nav-obs-${storyStr}-${frameStr}`;
          html += `
      <div id="${frameLink}" class="section obs-sq-chapter-frame-section">
        <h3 class="header sq-frame-header"><a href="#${frameLink}" class="header-link">${storyStr}:${frameStr}</a></h3>
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
        <div class="sq-frame-text">
          ${obsData.stories[storyIdx].frames[frameIdx].content}
        </div>
`;
          if (sqTsvData?.[storyStr]?.[frameStr]) {
            for (let rowIdx in sqTsvData[storyStr][frameStr]) {
              const row = sqTsvData[storyStr][frameStr][rowIdx];
              const questionLink = `nav-obs-${storyStr}-${frameStr}-${row.ID}`;
              if (row.Question) {
                let article = `
              <div id="${questionLink}" class="sq-question-article">
                <div class="sq-entry">
                  <h4 class="sq-entry-question">
                    <a class="header-link" href="#${questionLink}">
                      ${row.Question}
                    </a>
                  </h4>
`;
                if (row.Response) {
                  article += `
                  <input type="checkbox" class="response-show-checkbox" id="checkbox-${row.ID}" style="display:none;">
                  <label class="response-show-label" for="checkbox-${row.ID}"></label>
                  <div class="sq-entry-response">
                    ${convertNoteFromMD2HTML(row.Response, 'obs', storyStr)}
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
          <div class="sq-verse-no-content">
            (There are no questions for this verse)
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

    if (obsData && sqTsvData) {
      generateHtml();
    }
  }, [
    catalogEntry,
    obsData,
    sqTsvBookFiles,
    sqTsvData,
    imageResolution,
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

    if (catalogEntry && builtWith.length && renderNewCopy) {
      generateCopyrightPage();
    }
  }, [catalogEntry, builtWith, authToken, renderNewCopy, setCopyright]);


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
