import { useState, useEffect, useContext } from "react";
import Typography from "@mui/joy/Typography";
import { useUsfmPreviewRenderer } from "@oce-editor-tools/base";
import DOMPurify from "dompurify";
import CircularProgressUI from "@mui/joy/CircularProgress";
import {
  getLtrPreviewStyle,
  getRtlPreviewStyle,
} from "../lib/previewStyling.js";
import { AppContext } from "./App.context";
import { decodeBase64ToUtf8 } from "../utils/base64Decode";
import { BASE_DCS_URL, API_PATH } from "../common/constants";
import BibleReference, { useBibleReference } from 'bible-reference-rcl';
import { ALL_BIBLE_BOOKS } from "../common/BooksOfTheBible.js";

export default function RcBible() {
  const [loading, setLoading] = useState(true)
  const [usfmText, setUsfmText] = useState()

  const {
    state: {
        catalogEntry,
        urlInfo,
    },
    actions: {
        setUrlInfo,
        setErrorMessage,
        setPrintHtml,
    },
  } = useContext(AppContext);
    
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

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: urlInfo?.extraPath[0] || catalogEntry?.ingredients.map(ingredient => ingredient.identifier).filter(book => book in ALL_BIBLE_BOOKS)[0] || "gen",
    initialChapter: urlInfo?.extraPath[1] || "1",
    initialVerse: urlInfo?.extraPath[2] || "1",
    supportedBooks: catalogEntry?.ingredients.map(ingredient => ingredient.identifier).filter(book => book in ALL_BIBLE_BOOKS),
  });

  const { renderedData, ready: htmlReady } = useUsfmPreviewRenderer({
    usfmText,
    renderFlags,
    renderStyles: catalogEntry
      ? catalogEntry.language_direction === "rtl"
        ? getRtlPreviewStyle()
        : getLtrPreviewStyle()
      : getLtrPreviewStyle(),
    htmlRender: true,
  });

  useEffect(() => {
    if (catalogEntry) {
        let book = ""
        if (urlInfo?.extraPath.length > 0) {
            book = urlInfo.extraPath[0]
        } else if (catalogEntry?.ingredients.length) {
            book = catalogEntry?.ingredients.map(ingredient => ingredient.identifier).filter(book => book in ALL_BIBLE_BOOKS)[0] || "gen"
        } else {
            setErrorMessage("No book given to render")
        }
        const chapter = urlInfo.extraPath[1] || "1"
        const verse = urlInfo.extraPath[2] || "1"
        setUrlInfo({...urlInfo, extraPath: [book, chapter, verse]})
        bibleReferenceActions.goToBookChapterVerse(book, chapter, verse)
    }
  }, [catalogEntry, urlInfo?.extraPath[0]])

  useEffect(() => {
    if (bibleReferenceState && urlInfo) {
        if (bibleReferenceState.bookId != urlInfo.extraPath[0]) {
            window.location.href = `/u/${urlInfo.owner}/${urlInfo.repo}/${urlInfo.ref}/${bibleReferenceState.bookId}`
        }
    }
  }, [bibleReferenceState?.bookId, urlInfo?.extraPath[0]])

  useEffect(() => {
    const handleInitialLoad = async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          const text = await response.text();
          throw Error(text);
        }

        const jsonResponse = await response.json();
        if (jsonResponse?.content) {
          const _usfmText = decodeBase64ToUtf8(jsonResponse.content);
          setUsfmText(_usfmText);
        }
        setLoading(false);
      } catch (error) {
        setErrorMessage(error?.message);
        setLoading(false);
      }
    };

    const loadFile = async () => {
      let filePath = null;
      for (let i = 0; i < catalogEntry.ingredients.length; ++i) {
        const ingredient = catalogEntry.ingredients[i];
        if (ingredient.identifier == bibleReferenceState.bookId) {
          filePath = ingredient.path;
          break;
        }
      }
      if (!filePath) {
        setErrorMessage("Book not supported");
        setLoading(false);
      } else {
        const fileURL = `${BASE_DCS_URL}/${API_PATH}/repos/${catalogEntry.owner}/${catalogEntry.repo.name}/contents/${filePath}?ref=${catalogEntry.commit_sha}`;
        handleInitialLoad(fileURL);
      }
    };

    if (loading && catalogEntry && bibleReferenceState?.bookId) {
      loadFile();
    }
  }, [loading, catalogEntry, bibleReferenceState?.bookId, setErrorMessage]);

  useEffect(() => {
    if (htmlReady) {
      setPrintHtml(renderedData);
    }
  }, [htmlReady, renderedData]);

  return (
    <>
      {loading ? (
        <>
          <Typography color="textPrimary" gutterBottom display="inline">
            <>Loading USFM file from server... </>
          </Typography>
          <CircularProgressUI />
        </>
      ) : htmlReady ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BibleReference status={bibleReferenceState} actions={bibleReferenceActions} />
          </div>
          <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(renderedData),
            }}
          />
        </>
      ) : (
        <>
          <Typography color="textPrimary" gutterBottom display="inline">
            <>Converting from Usfm... </>
          </Typography>
          <CircularProgressUI />
        </>
      )}
    </>
  );
}
