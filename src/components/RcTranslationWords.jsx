// React imports
import { useEffect, useContext, useState } from 'react';

// Context imports
import { AppContext } from '@components/App.context';

// Component imports
import TwNavigation from './TwNavigation';

// Custom hook imports
import useGenerateTranslationWordsManuals from '../hooks/useGenerateTranslationWordsManuals';
import useGenerateTranslationWordsHtml from '../hooks/useGenerateTranslationWordsHtml';
import useFetchZipFileData from '../hooks/useFetchZipFileData';

// Helper imports
import { getRepoContentsContent } from '@helpers/dcsApi';

// Library imports
import MarkdownIt from 'markdown-it';

const webCss = `
section > section:nth-child(1),
section > article:nth-child(1) {
  break-before: avoid;
}

h5, h6 {
  font-size: 1em;
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

.article-body h1, .article-body h2, .article-body h3, .article-body h4 {
  font-size: 1em;
}

hr.divider {
  width: 100%;
}

hr.divider.depth-1 {
  width: 90%;
}

hr.divider.depth-2 {
  width: 80%;
}

hr.divider.depth-3 {
  width: 70%;
}

hr.divider.depth-4 {
  width: 60%;
}

hr.divider.depth-5 {
  width: 40%;
}

hr.article-divider {
  width: 50%;
}

// .section-header a {
//   border-bottom: 3px double;
// }

// .article-header a {
//   border-bottom: 1px solid;
// }

.manual > h1 {
  text-align: center;
}
`;

const printCss = `
#pagedjs-print .section-header a {
  border-bottom: none;
}

#pagedjs-print .article-header a {
  border-bottom: none;
}

#pagedjs-print hr.article-divider {
  display: none;
}

#pagedjs-print a,
#pagedjs-print a:hover,
#pagedjs-print a:visited {
  color: inherit;
}
`;

export default function RcTranslationWords() {
  const {
    state: { catalogEntry, navAnchor, authToken },
    actions: { setStatusMessage, setErrorMessage, setHtmlSections, setNavAnchor, setBuiltWith },
  } = useContext(AppContext);

  const [copyright, setCopyright] = useState('');

  const zipFileData = useFetchZipFileData({ catalogEntry, authToken });

  const twManuals = useGenerateTranslationWordsManuals({ catalogEntry, zipFileData, setErrorMessage });

  const html = useGenerateTranslationWordsHtml({ catalogEntry, taManuals: twManuals });

  useEffect(() => {
    setStatusMessage(
      <>
        Preparing {catalogEntry.subject} Preview.
        <br />
        Please wait...
      </>
    );
    setHtmlSections((prevState) => {return {...prevState, css: {web: webCss, print: printCss}}});
  }, [catalogEntry, setStatusMessage, setHtmlSections]);

  useEffect(() => {
    if (catalogEntry) {
      setBuiltWith([catalogEntry])
    }
  }, [catalogEntry, setBuiltWith])

  useEffect(() => {
    const generateCopyrightPage = async () => {
      const entries = [catalogEntry];

      let copyrightAndLicense = `<h1>Copyright s and Licenceing</h1>`;
      for (let entry of entries) {
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
        copyrightAndLicense += `<div class="license">` + md.render(await getRepoContentsContent(catalogEntry.repo.url, 'LICENSE.md', catalogEntry.commit_sha, authToken)) + `</div>`;
      } catch (e) {
        console.log(`Error calling getRepoContentsContent(${catalogEntry.repo.url}, "LICENSE.md", ${catalogEntry.commit_sha}): `, e);
      }

      setCopyright(copyrightAndLicense);
    };

    if (catalogEntry) {
      generateCopyrightPage();
    }
  }, [catalogEntry, setCopyright]);

  useEffect(() => {
    if (html && copyright) {
      setHtmlSections((prevState) => ({
        ...prevState,
        copyright,
        body: html,
      }));
      setStatusMessage('');
    }
  }, [html, copyright, setHtmlSections, setStatusMessage]);

  return <TwNavigation twManuals={twManuals} anchor={navAnchor} setNavAnchor={setNavAnchor} />;
}
