// React imports
import { useEffect, useContext, useState } from 'react';

// Context imports
import { AppContext } from '@components/App.context';

// Component imports
import TwNavigation from './TwNavigation';

// Custom hook imports
import useGenerateTranslationWordsManuals from '@hooks/useGenerateTranslationWordsManuals';
import useGenerateTranslationWordsHtml from '@hooks/useGenerateTranslationWordsHtml';
import useFetchZipFileData from '@hooks/useFetchZipFileData';

// Library imports
import { generateCopyrightAndLicenseHTML } from '@helpers/html';

const webCss = `
.section > section:nth-child(1),
.section > article:nth-child(1) {
  break-before: avoid;
}

h5, h6 {
  font-size: 1em !important;
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
    state: { catalogEntry, builtWith, navAnchor, authToken },
    actions: { setStatusMessage, setErrorMessage, setHtmlSections, setNavAnchor, setBuiltWith },
  } = useContext(AppContext);

  const [copyright, setCopyright] = useState('');

  const zipFileData = useFetchZipFileData({ catalogEntry, authToken });

  const twManuals = useGenerateTranslationWordsManuals({ catalogEntry, zipFileData, setErrorMessage });

  const html = useGenerateTranslationWordsHtml({ catalogEntry, taManuals: twManuals });

  useEffect(() => {
    if (! catalogEntry ) {
      return;
    }
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
        copyright,
        body: html,
      }));
      setStatusMessage('');
    }
  }, [html, copyright, setHtmlSections, setStatusMessage]);

  return <TwNavigation twManuals={twManuals} anchor={navAnchor} setNavAnchor={setNavAnchor} />;
}
