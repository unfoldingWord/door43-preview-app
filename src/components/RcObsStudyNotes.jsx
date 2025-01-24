// React imports
import { useState, useEffect, useContext, useMemo } from 'react';

// Bible reference imports
import BibleReference, { useBibleReference } from 'bible-reference-rcl';

// Helper imports
import { convertNoteFromMD2HTML } from '@helpers/html';
import { getOBSImgURL } from '@helpers/obs_helpers';

// Material UI imports
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material';

// Hook imports
import useFetchRelationCatalogEntries from '@hooks/useFetchRelationCatalogEntries';
import useFetchCatalogEntriesBySubject from '@hooks/useFetchCatalogEntriesBySubject';
import useFetchBookFiles from '@hooks/useFetchBookFiles';
import useFetchZipFileData from '@hooks/useFetchZipFileData';
import usePivotTsvFileOnReference from '@hooks/usePivotTsvFileOnReference';
import useGetOBSData from '@hooks/useGetOBSData';

// Context imports
import { AppContext } from '@components/App.context';
import { generateCopyrightAndLicenseHTML } from '@helpers/html';

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
.obs-sn-frame-block {
  border: 1px solid black;
  padding: 10px;
  margin-bottom: 10px;
}

.obs-sn-frame-header {
  margin: 0;
}

.obs-sn-frame-text {
  font-style: italic;
}

.obs-sn-note-body h3 {
  font-size: 1.3em;
  margin: 10px 0;
}

.obs-sn-note-body h4 {
  font-size: 1.2em;
  margin: 10px 0;
}

.obs-sn-note-body h5 {
  font-size: 1.1em;
  margin: 10px 0;
}

.obs-sn-note-body h6 {
  font-size: 1em !important;
  margin: 10px 0;
}

.obs-sn-note-label,
.obs-sn-note-quote {
  font-weight: bold;
}

.obs-sn-note-support-reference,
.obs-sn-note-quote {
  margin-bottom: 10px;
}

.article {
  break-after: auto !important;
  break-inside: avoid !important;
  orphans: 2;
  widows: 2;
}

hr {
  break-before: avoid !important;
}

.ta.appendex article {
  break-after: page !important;
}

a.header-link {
  font-weight: inherit !important;
  font-size: inherit !important;
  color: #000000;
  text-decoration: none;
}

a.header-link:hover::after {
  content: '#';
  padding-left: 5px;
  color: blue;
  display: inline-block;
}

.ta.appendex .article-body h1,
.article-body h2,
.article-body h3,
.article-body h4 {
  font-size: 1em;
}

.title-page {
  text-align: center;
}

.obs-sn-frame-twl-bible {
  margin-bottom: 0;
}

.obs-sn-frame-twl-list {
  margin: 0;
}

.obs-sn-frame-twl-list-item a {
  text-decoration: none;
}
`;

const requiredSubjects = ['Open Bible Stories'];

export default function RcObsStudyNotes() {
  const {
    state: { urlInfo, catalogEntry, navAnchor, authToken, builtWith, renderNewCopy },
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
    initialChapter: urlInfo.hashParts[1] || '1',
    initialVerse: urlInfo.hashParts[2] || '1',
    addOBS: true,
    onChange: onBibleReferenceChange,
  });

  const relationCatalogEntries = useFetchRelationCatalogEntries({
    catalogEntry,
    requiredSubjects,
    bookId: 'obs',
  });

  const catalogEntries = useMemo(() => catalogEntry ? [catalogEntry] : [], [catalogEntry]);

  const tnTsvBookFiles = useFetchBookFiles({
    catalogEntries,
    bookId: 'obs',
    canFetch: renderNewCopy,
  });

  const snTsvData = usePivotTsvFileOnReference({
    tsvBookFile: tnTsvBookFiles?.[0],
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
    if (navAnchor && ! navAnchor.includes('--')) {
      const parts = navAnchor.split('-');
      if (bibleReferenceState.bookId == parts[0] && (bibleReferenceState.chapter != (parts[1] || '1') || bibleReferenceState.verse != (parts[2] || '1'))) {
        bibleReferenceActions.goToBookChapterVerse(parts[0], parts[1] || '1', parts[2] || '1');
      }
    }
  }, [navAnchor]);

  useEffect(() => {
    if (catalogEntry) {
      setBuiltWith([
        catalogEntry,
        ...(obsCatalogEntries?.[0] ? [obsCatalogEntries[0]] : []),
      ]);
    }
  }, [catalogEntry, obsCatalogEntries, setBuiltWith]);

  useEffect(() => {
    const sb = ['obs'];
    bibleReferenceActions.applyBooksFilter(sb);
    setSupportedBooks(sb);
    setHtmlSections((prevState) => {
      return { ...prevState, css: { web: webCss, print: '' } };
    });
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
  }, [catalogEntry, setCanChangeColumns, setErrorMessage, setHtmlSections, setStatusMessage, setSupportedBooks]);

  useEffect(() => {
    const generateHtml = async () => {
      let html = `
<div class="section obs-sn-book-section" id="nav-obs" data-toc-title="${catalogEntry.title}">
  <h1 class="header obs-sn-book-section-header"><a href="#nav-obs" class="header-link">${catalogEntry.title}</a></h1>
`;
      if (snTsvData?.front?.intro) {
        html += `
  <div class="section obs-sn-front-intro-section" data-toc-title="Introduciton">
`;
        for (let row of snTsvData['front']['intro']) {
          html += `
    <div class="article obs-sn-front-intro-note">
      <span class="header-title">${catalogEntry.title} :: Introduction</span>
      <div class="obs-sn-note-body">
${convertNoteFromMD2HTML(row.Note, 'obs', 'front')}
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
        if (snTsvData?.[storyStr]?.['intro']) {
          html += `
      <div class="section obs-sn-chapter-intro-section">
`;
          for (let row of snTsvData[storyStr]['intro']) {
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
      <div id="${frameLink}" class="section obs-sn-chapter-frame-section">
        <h3 class="header obs-sn-frame-header"><a href="#${frameLink}" class="header-link">${storyStr}:${frameStr}</a></h3>
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
        <div class="obs-sn-frame-text">
          ${obsData.stories[storyIdx].frames[frameIdx].content}
        </div>
`;
          if (snTsvData?.[storyStr]?.[frameStr]) {
            for (let rowIdx in snTsvData[storyStr][frameStr]) {
              const row = snTsvData[storyStr][frameStr][rowIdx];
              const noteLink = `nav-obs-${storyStr}-${frameStr}-${row.ID}`;
              let article = `
        <div class="article obs-sn-note-article" id="${noteLink}">
`;
              if (!row.Quote) {
                article += `
          <h4 class="header obs-sn-note-header">
            <a href="#${noteLink}" class="header-link">
            Note:
            </a>
          </h4>
`;
              } else {
                article += `
          <h4 class="header obs-sn-note-header">
            <a href="#${noteLink}" class="header-link">
              ${row.Quote}
            </a>
          </h4>
`;
              }

              article += `
          <span class="header-title">${catalogEntry.title} :: ${row.Reference}</span>
          <div class="obs-sn-note-body">
            ${convertNoteFromMD2HTML(row.Note, 'obs', storyStr)}
          </div>
`;
              if (row.SupportReference) {
                article += `
          <div class="obs-sn-note-support-reference">
            <span class="obs-sn-note-label">Support Reference:&nbsp;</span>
              [[${row.SupportReference}]]
          </div>
`;
              }
              article += `
          <hr style="width: 75%"/>
        </div>
`;
              html += article;
            }
          } else {
            html += `
        <div class="article obs-sn-frame-no-content">
          (There are no notes for this frame)
        </div>
`;
          }

          html += `
        <hr style="width: 100%"/>
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

    if (snTsvData && obsData) {
      generateHtml();
    }
  }, [
    catalogEntry,
    html,
    snTsvData,
    obsData,
    imageResolution,
    setHtmlSections,
    setErrorMessage,
    setNavAnchor,
  ]);

  useEffect(() => {
    const generateCopyrightPage = async () => {
      const copyrightAndLicense = await generateCopyrightAndLicenseHTML(
        catalogEntry,
        builtWith,
        authToken,
      );
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
        copyright,
        body: html,
      }));
      setStatusMessage('');
    }
  }, [html, copyright, catalogEntry, setHtmlSections, setStatusMessage]);

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
