import { useState, useEffect, useContext } from "react";
import Typography from "@mui/joy/Typography";
import DOMPurify from "dompurify";
import CircularProgressUI from "@mui/joy/CircularProgress";
import { AppContext } from "./App.context";
import { decodeBase64ToUtf8 } from "../utils/base64Decode";
import { API_PATH } from "../common/constants";
import markdown from '../lib/drawdown'

export default function RcOpenBibleStories() {
  const [loading, setLoading] = useState(true)
  const [storiesMarkdown, setStoriesMarkdown] = useState()
  const [html, setHtml] = useState("")

  const {
    state: {
        catalogEntry,
        serverInfo,
    },
    actions: {
        setErrorMessage,
        setPrintHtml,
    },
  } = useContext(AppContext);

  useEffect(() => {
    const downloadFile = async (url) => {
      try {
        const response = await fetch(url)
        if (!response.ok && response.status != 404) {
          const text = await response.text()
          throw Error(text)
        }
        if (response.status == 200) {
            const jsonResponse = await response.json()
            if (jsonResponse?.content) {
              return decodeBase64ToUtf8(jsonResponse.content)
            }
        } else {
             return ""
        }
      } catch (error) {
        setErrorMessage(error?.message);
        setLoading(false);
      }
    }

    const loadMarkdownFiles = async () => {
      let markdownFiles = []
      for (let i = 1; i < 51; ++i) {
        const filePath = "content/" + `${i}`.padStart(2, '0') + ".md";
        const fileURL = `${serverInfo.baseUrl}/${API_PATH}/repos/${catalogEntry.owner}/${catalogEntry.repo.name}/contents/${filePath}?ref=${catalogEntry.commit_sha}`;
        const markdownFile = await downloadFile(fileURL);
        markdownFiles.push(markdownFile ? markdownFile : `# ${i}. STORY NOT FOUND!\n\n`)
      }
      setStoriesMarkdown(markdownFiles)
      setLoading(false)
    }

    if (catalogEntry && serverInfo?.baseUrl) {
      loadMarkdownFiles();
    }
  }, [catalogEntry, setErrorMessage, serverInfo?.baseUrl]);

  useEffect(() => {
    if (! html && storiesMarkdown) {
        let _html = ""
        storiesMarkdown.forEach(storyMarkdown => {
            _html += markdown(storyMarkdown)
        })
        setHtml(_html)
        setPrintHtml(_html)
    }
  }, [storiesMarkdown, html])

  return (
    <>
      {html ? (
        <>
          <div style={{direction: catalogEntry ? catalogEntry.language_direction : "ltr"}}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(html),
            }}
          />
        </>
      ) : loading ? (
        <>
          <Typography color="textPrimary" gutterBottom display="inline">
            <>Loading files from server... </>
          </Typography>
          <CircularProgressUI />
        </>
      ) : (
        <>
          <Typography color="textPrimary" gutterBottom display="inline">
            <>Converting to HTML... </>
          </Typography>
          <CircularProgressUI />
        </>
      )}
    </>
  );
}
