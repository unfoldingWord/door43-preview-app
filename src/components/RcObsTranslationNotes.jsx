// React imports
import { useState, useEffect, useContext, useMemo } from 'react';

// Bible reference imports
import BibleReference, { useBibleReference } from 'bible-reference-rcl';

// Helper imports
import { getRepoContentsContent } from '@helpers/dcsApi';
import { encodeHTML, convertNoteFromMD2HTML } from '@helpers/html';
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
import useGenerateTranslationAcademyFileContents from '@hooks/useGenerateTranslationAcademyFileContents';
import useGenerateTranslationWordsFileContents from '@hooks/useGenerateTranslationWordsFileContents';
import useGetOBSData from '@hooks/useGetOBSData';

// Other imports
import MarkdownIt from 'markdown-it';

// Context imports
import { AppContext } from '@components/App.context';

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
.obs-tn-frame-block {
  border: 1px solid black;
  padding: 10px;
  margin-bottom: 10px;
}

.obs-tn-frame-header {
  margin: 0;
}

.obs-tn-frame-text {
  font-style: italic;
}

.obs-tn-note-body h3 {
  font-size: 1.3em;
  margin: 10px 0;
}

.obs-tn-note-body h4 {
  font-size: 1.2em;
  margin: 10px 0;
}

.obs-tn-note-body h5 {
  font-size: 1.1em;
  margin: 10px 0;
}

.obs-tn-note-body h6 {
  font-size: 1em;
  margin: 10px 0;
}

.obs-tn-note-label,
.obs-tn-note-quote {
  font-weight: bold;
}

.obs-tn-note-support-reference,
.obs-tn-note-quote {
  margin-bottom: 10px;
}

.section {
  break-after: page !important;
}

article {
  break-after: auto !important;
  break-inside: avoid-page !important;
  orphans: 2;
  widows: 2;
}

hr {
  break-before: avoid-page !important;
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

.obs-tn-frame-twl-bible {
  margin-bottom: 0;
}

.obs-tn-frame-twl-list {
  margin: 0;
}

.obs-tn-frame-twl-list-item a {
  text-decoration: none;
}
`;

const requiredSubjects = ['Translation Academy', 'Translation Words', 'TSV OBS Translation Words Links'];

export default function RcObsTranslationNotes() {
  const {
    state: { urlInfo, catalogEntry, bookId, htmlSections, navAnchor, authToken, builtWith },
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
    if (bookId && b != bookId) {
      window.location.hash = b;
      window.location.reload();
    } else {
      const hash = `${b}-${c}-${v}`;
      if (!navAnchor.startsWith(hash)) {
        setNavAnchor(hash);
      }
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
    setErrorMessage,
    bookId,
    authToken,
  });

  const catalogEntries = useMemo(() => [catalogEntry], [catalogEntry]);

  const tnTsvBookFiles = useFetchBookFiles({
    catalogEntries,
    bookId: 'obs',
    setErrorMessage,
  });

  const tnTsvData = usePivotTsvFileOnReference({
    tsvBookFile: tnTsvBookFiles?.[0],
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

  const taCatalogEntries = useFetchCatalogEntriesBySubject({
    catalogEntries: relationCatalogEntries,
    subject: 'Translation Academy',
    firstOnly: true,
    setErrorMessage,
  });

  const taZipFileData = useFetchZipFileData({
    authToken,
    catalogEntry: taCatalogEntries?.[0],
  });

  const taFileContents = useGenerateTranslationAcademyFileContents({
    catalogEntry: taCatalogEntries[0],
    zipFileData: taZipFileData,
    setErrorMessage,
  });

  const twCatalogEntries = useFetchCatalogEntriesBySubject({
    catalogEntries: relationCatalogEntries,
    subject: 'Translation Words',
    firstOnly: true,
    setErrorMessage,
  });

  const twZipFileData = useFetchZipFileData({
    authToken,
    catalogEntry: twCatalogEntries?.[0],
  });

  const twFileContents = useGenerateTranslationWordsFileContents({
    catalogEntry: twCatalogEntries?.[0],
    zipFileData: twZipFileData,
    setErrorMessage,
  });

  const twlCatalogEntries = useFetchCatalogEntriesBySubject({
    catalogEntries: relationCatalogEntries,
    subject: 'TSV OBS Translation Words Links',
    firstOnly: true,
    setErrorMessage,
  });

  const twlTSVBookFiles = useFetchBookFiles({
    catalogEntries: twlCatalogEntries,
    bookId,
    setErrorMessage,
  });

  const twlTsvData = usePivotTsvFileOnReference({
    tsvBookFile: twlTSVBookFiles?.[0],
  });

  useEffect(() => {
    if (navAnchor && navAnchor.split('-').length) {
      const parts = navAnchor.split('-');
      if (bibleReferenceState.bookId == parts[0] && (bibleReferenceState.chapter != (parts[1] || '1') || bibleReferenceState.verse != (parts[2] || '1'))) {
        bibleReferenceActions.goToBookChapterVerse(parts[0], parts[1] || '1', parts[2] || '1');
      }
    }
  }, [navAnchor]);

  useEffect(() => {
    if (catalogEntry) {
      setBuiltWith([catalogEntry, ...(taCatalogEntries || []), ...(twCatalogEntries || []), ...(twlCatalogEntries || [])]);
    }
  }, [catalogEntry, taCatalogEntries, twCatalogEntries, twlCatalogEntries, setBuiltWith]);

  useEffect(() => {
    if (!catalogEntry) {
      setErrorMessage('No catalog entry for this resource found.');
      return;
    }
    setStatusMessage(
      <>
        Preparing preview for {catalogEntry.title}.
        <br />
        Please wait...
      </>
    );
    bibleReferenceActions.applyBooksFilter(['obs']);
    setSupportedBooks('obs');
    setBookId('obs');
    setHtmlSections((prevState) => {
      return { ...prevState, css: { web: webCss, print: '' } };
    });
    setCanChangeColumns(false);
  }, [catalogEntry, setCanChangeColumns, setErrorMessage, setBookId, setHtmlSections, setStatusMessage, setSupportedBooks]);

  useEffect(() => {
    const searchForRcLinks = (data, article, referenceWithLink = '') => {
      const rcLinkRegex = /rc:\/\/[^/]+\/([^/]+)\/[^/]+\/([A-Za-z0-9/_-]+)/g;
      let match;
      while ((match = rcLinkRegex.exec(article)) !== null) {
        const [rcLink, resource, file] = match;
        if (!data[resource]) {
          data[resource] = {};
        }
        if (!data[resource][rcLink]) {
          data[resource][rcLink] = {
            backRefs: [],
            title: file,
            body: `${resource.toUpperCase()} ARTICLE NOT FOUND`,
            rcLink,
            anchor: `appendex--${resource}--${file.replace(/\//g, '--')}`,
          };
          const fileParts = file.split('/');
          switch (resource) {
            case 'ta':
              {
                const manualId = fileParts[0];
                const articleId = fileParts.slice(1).join('/');
                data[resource][rcLink].title = taFileContents?.[manualId]?.articles?.[articleId]?.title || `TA ARTICLE FOR ${manualId} :: ${articleId} NOT FOUND!`;
                data[resource][rcLink].body = taFileContents?.[manualId]?.articles?.[articleId]?.body || '';
              }
              break;
            case 'tw':
              {
                const category = fileParts[1];
                const articleId = fileParts.slice(2).join('/');
                data[resource][rcLink].title = twFileContents?.[category]?.articles?.[articleId]?.title || `TW ARTICLE FOR ${category} :: ${articleId} NOT FOUND!`;
                data[resource][rcLink].body = twFileContents?.[category]?.articles[articleId]?.body || '';
              }
              break;
          }
        }
        if (referenceWithLink && ! data[resource][rcLink].backRefs.includes(referenceWithLink)) {
          data[resource][rcLink].backRefs.push(referenceWithLink);
        }
      }
      return data;
    };

    const generateHtml = async () => {
      let html = `
<div class="section obs-tn-book-section" id="obs-tn-${bookId}" data-nav-id="${bookId}" data-toc-title="${catalogEntry.title}">
  <h1 class="header obs-tn-book-section-header"><a href="#tn-${bookId}" data-nav-anchor="${bookId}" class="header-link">${catalogEntry.title}</a></h1>
`;
      const rcLinksData = {};

      if (tnTsvData?.['front']?.['intro']) {
        html += `
  <div class="section obs-tn-front-intro-section" data-toc-title="Introduciton">
`;
        for (let row of tnTsvData['front']['intro']) {
          html += `
    <article class="obs-tn-front-intro-note">
      <span class="header-title">${catalogEntry.title} :: Introduction</span>
      <div class="obs-tn-note-body">
${convertNoteFromMD2HTML(row.Note, 'tn', bookId, 'front')}
      </div>
    </article>
`;
        }
        html += `
  </div>
`;
      }

      for (let storyIdx = 0; storyIdx < 50; storyIdx++) {
        const storyStr = String(storyIdx + 1);
        html += `
  <div id="obs-tn-${bookId}-${storyStr}" data-nav-id="${bookId}-${storyStr}" class="section obs-tn-chapter-section" data-toc-title="${obsData.stories[storyIdx].title}">
    <h2 class="obs-tn-chapter-header"><a href="#tn-${bookId}-${storyStr}" data-nav-anchor="${bookId}-${storyStr}" class="header-link">${obsData.stories[storyIdx].title}</a></h2>
`;
        if (tnTsvData?.[storyStr]?.['intro']) {
          html += `
      <div class="section obs-tn-chapter-intro-section">
`;
          for (let row of tnTsvData[storyStr]['intro']) {
            const link = `${bookId}-${storyStr}-intro-${row.ID}`;
            const article = `
        <article id="obs-tn-${link}" data-nav-id"${link}">
          <span class="header-title">${catalogEntry.title} :: Introduction</span>
          ${convertNoteFromMD2HTML(row.Note, 'tn', bookId, storyStr)}
        </article>
`;
            searchForRcLinks(rcLinksData, article, `<a href="#${link}">${row.Reference}</a>`);
            html += article;
          }
          html += `
      </div>
`;
        }

        for (let frameIdx = 0; frameIdx < obsData.stories[storyIdx].frames.length; frameIdx++) {
          const frameStr = String(frameIdx + 1);
          const frameLink = `${bookId}-${storyStr}-${frameStr}`;
          html += `
      <div id="obs-tn-${frameLink}" data-nav-id="${frameLink}" class="section obs-tn-chapter-frame-section">
        <h3 class="obs-tn-frame-header"><a href="#tn-${frameLink}" data-nav-anchor="${frameLink}" class="header-link">${storyStr}:${frameStr}</a></h3>
        <span class="header-title">${catalogEntry.title} :: ${storyStr}:${frameStr}</span>
`;
        if (imageResolution != 'none') {
          html += `
        <img src="${await getOBSImgURL({ storyNum: storyStr, frameNum: frameStr, resolution: imageResolution })}" alt="Frame ${storyStr}-${frameStr}">
`;
      }

          html += `
        <div class="obs-tn-frame-text">
          ${obsData.stories[storyIdx].frames[frameIdx].content}
        </div>
`;
          if (tnTsvData?.[storyStr]?.[frameStr]) {
            for (let rowIdx in tnTsvData[storyStr][frameStr]) {
              const row = tnTsvData[storyStr][frameStr][rowIdx];
              const noteLink = `${bookId}-${storyStr}-${frameStr}-${row.ID}`;
              let article = `
        <article id="obs-tn-${noteLink}" data-nav-id="${noteLink}" class="obs-tn-note-article">
`;

              if (!row.Quote) {
                article += `
          <h4 class="obs-tn-note-header">
            <a href="#tn-${noteLink}" data-nav-anchor="${noteLink}" class="header-link">
            Note:
            </a>
          </h4>
`;
              } else {
                article += `
          <h4 class="obs-tn-note-header">
            <a href="#${noteLink}" class="header-link">
              ${row.Quote}
            </a>
          </h4>
`;
              }

              article += `
          <span class="header-title">${catalogEntry.title} :: ${row.Reference}</span>
          <div class="obs-tn-note-body">
            ${convertNoteFromMD2HTML(row.Note, 'obs-tn', bookId, storyStr)}
          </div>
`;
              if (row.SupportReference) {
                article += `
          <div class="obs-tn-note-support-reference">
            <span class="obs-tn-note-label">Support Reference:&nbsp;</span>
              [[${row.SupportReference}]]
          </div>
`;
              }
              article += `
          <hr style="width: 75%"/>
        </article>
`;
              html += article;
              searchForRcLinks(rcLinksData, article, `<a href="#${noteLink}">${row.Reference}</a>`);
            }
          } else {
            html += `
        <article class="obs-tn-frame-no-content">
          (There are no notes for this frame)
        </article>
`;
          }

          // TW LINKS
          if (twlTsvData?.[storyStr]?.[frameStr]) {
            const twlLink = `twl-${storyStr}-${frameStr}`;
            let article = `
        <article id="${twlLink}" class="obs-tn-frame-twls">
          <h4 class="obs-tn-frame-twl-header">${twCatalogEntries?.[0].title}</h4>
          <ul class="obs-tn-frame-twl-list">
`;
            for (let row of twlTsvData[storyStr][frameStr]) {
              article += `
            <li class="obs-tn-frame-twl-list-item"><a href="${row.TWLink}">${row.OrigWords}</a></li>
`;
            }
            article += `
          </ul>
        </article>
`;
            html += article;
            searchForRcLinks(rcLinksData, article, `<a href="#${frameLink}">${storyStr}:${frameStr}</a>`);
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
      if (rcLinksData.ta && taCatalogEntries.length) {
        const taCatalogEntry = taCatalogEntries[0];
        // TA ARTICLES
        html += `
<div class="appendex ta section" id="appendex-ta" data-toc-title="Appendex: ${encodeHTML(taCatalogEntry.title)}">
  <article class="title-page">
    <span class="header-title"></span>
    <img class="title-logo" src="https://cdn.door43.org/assets/uw-icons/logo-uta-256.png" alt="uta">
    <h1 class="cover-header section-header">${taCatalogEntry.title} - OBS</h1>
    <h3 class="cover-version">${taCatalogEntry.branch_or_tag_name}</h3>
  </article>
`;
        Object.values(rcLinksData.ta)
          .sort((a, b) => (a.title.toLowerCase() < b.title.toLowerCase() ? -1 : a.title.toLowerCase() > b.title.toLowerCase() ? 1 : 0))
          .forEach((taArticle) => {
            const article = `
  <article id="${taArticle.anchor}" data-toc-title="${encodeHTML(taArticle.title)}">
    <h2 class="header article-header">
      <a href="#${taArticle.anchor}" class="header-link">${taArticle.title}</a>
    </h2>
    <span class="header-title">${taCatalogEntry.title} :: ${taArticle.title}</span>
    <div class="article-body">
      ${taArticle.body}
    </div>
    <div class="back-refs">
    <h3>OBS References:</h3>
    ${taArticle.backRefs.join('; ')}
  </article>
`;
            html += article;
            searchForRcLinks(rcLinksData, article);
          });
        html += `
</div>
`;
      }
      if (rcLinksData.tw && twCatalogEntries.length) {
        const twCatalogEntry = twCatalogEntries[0];
        // TW ARTICLES
        html += `
<div class="appendex tw section" id="appendex-tw" data-toc-title="Appendex: ${encodeHTML(twCatalogEntry.title)}">
  <article class="title-page">
    <span class="header-title"></span>
    <img class="title-logo" src="https://cdn.door43.org/assets/uw-icons/logo-utw-256.png" alt="uta">
    <h1 class="cover-header section-header">${twCatalogEntry.title} - OBS</h1>
    <h3 class="cover-version">${twCatalogEntry.branch_or_tag_name}</h3>
  </article>
`;
        Object.values(rcLinksData.tw)
          .sort((a, b) => (a.title.toLowerCase() < b.title.toLowerCase() ? -1 : a.title.toLowerCase() > b.title.toLowerCase() ? 1 : 0))
          .forEach((twArticle) => {
            const article = `
  <article id="${twArticle.anchor}" data-toc-title="${encodeHTML(twArticle.title)}">
    <h2 class="header article-header">
      <a href="#${twArticle.anchor}" class="header-link">${twArticle.title}</a>
    </h2>
    <span class="header-title">${twCatalogEntry.title} :: ${twArticle.title}</span>
    <div class="article-body">
      ${twArticle.body}
    </div>
    <div class="back-refs">
    <h3>OBS References:</h3>
    ${twArticle.backRefs.join('; ')}
  </article>
`;
            html += article;
            searchForRcLinks(rcLinksData, article);
          });
        html += `
</div>
`;
      }

      for (let data of Object.values(rcLinksData.ta || {})) {
        let regex = new RegExp(`href="#*${data.rcLink.replace(/rc:\/\/[^/]+\//, 'rc://[^/]+/')}"`, 'g');
        html = html.replace(regex, `href="#${data.anchor}"`);
        regex = new RegExp(`\\[*${data.rcLink.replace(/rc:\/\/[^/]+\//, 'rc://[^/]+/')}\\]*`, 'g');
        html = html.replace(regex, `<a href="#${data.anchor}">${data.title}</a>`);
      }
      for (let data of Object.values(rcLinksData.tw || {})) {
        let regex = new RegExp(`href="#*${data.rcLink.replace(/rc:\/\/[^/]+\//, 'rc://[^/]+/')}"`, 'g');
        html = html.replace(regex, `href="#${data.anchor}"`);
        regex = new RegExp(`\\[*${data.rcLink.replace(/rc:\/\/[^/]+\//, 'rc://[^/]+/')}\\]*`, 'g');
        html = html.replace(regex, `<a href="#${data.anchor}">${data.title}</a>`);
      }
      setHtml(html);
    };

    if (tnTsvData && obsData && twlTsvData && taFileContents && twFileContents) {
      generateHtml();
    }
  }, [
    catalogEntry,
    html,
    taCatalogEntries,
    bookId,
    tnTsvData,
    obsData,
    taFileContents,
    twCatalogEntries,
    twFileContents,
    twlTsvData,
    imageResolution,
    setHtmlSections,
    setErrorMessage,
    setNavAnchor,
  ]);

  useEffect(() => {
    const generateCopyrightPage = async () => {
      let copyrightAndLicense = `<h1>Copyright s and Licenceing</h1>`;
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

      const md = new MarkdownIt();
      try {
        copyrightAndLicense +=
          `<div class="license">` + md.render(await getRepoContentsContent(catalogEntry.repo.url, 'LICENSE.md', catalogEntry.commit_sha, authToken)) + `</div>`;
      } catch (e) {
        console.log(`Error calling getRepoContentsContent(${catalogEntry.repo.url}, "LICENSE.md", ${catalogEntry.commit_sha}): `, e);
      }

      setCopyright(copyrightAndLicense);
    };

    if (!htmlSections?.copyright && catalogEntry && builtWith.length) {
      generateCopyrightPage();
    }
  }, [htmlSections, catalogEntry, builtWith, authToken, setCopyright]);

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
  </ThemeProvider>)
}
