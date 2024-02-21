import { useState, useEffect, useContext } from "react";
import PropTypes from "prop-types";
import Typography from "@mui/joy/Typography";
import DOMPurify from "dompurify";
import CircularProgressUI from "@mui/joy/CircularProgress";
import BibleReference, { useBibleReference } from "bible-reference-rcl";
import markdownit from "markdown-it";

export default function RcTranslationWords({
  urlInfo,
  catalogEntry,
  zipFileData,
  updateUrlHashInAddressBar,
  setHtml,
}) {
  const [storiesMarkdown, setStoriesMarkdown] = useState();
  const [html, setHtml] = useState("");

  const onBibleReferenceChange = (b, c, v) => {
    const storyNum = parseInt(c);
    const frameNum = parseInt(v);
    const story = document.getElementById(`obs-${storyNum}-1`);
    if ((storyNum == 1 && frameNum == 1) || !story) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (story) {
      let frame = story;
      if (frameNum > 1 && story.children[frameNum * 2]) {
        frame = story.children[frameNum * 2 - 1]; // *2 because 2 elements for every frame: image & text; -1 because one title element
      }
      if (frame) {
        window.scrollTo({
          top: frame.getBoundingClientRect().top + window.scrollY - 80,
          behavior: "smooth",
        });
      }
    }
    if (updateUrlHashInAddressBar) {
      let hashParts = [b];
      if (
        c != "1" ||
        v != "1" ||
        urlInfo.hashParts[1] ||
        urlInfo.hashParts[2]
      ) {
        hashParts = [b, c, v];
      }
      updateUrlHashInAddressBar(hashParts);
    }
  };
  const { state: bibleReferenceState, actions: bibleReferenceActions } =
    useBibleReference({
      initialBook: "obs",
      initialChapter: urlInfo.hashParts[1] || "1",
      initialVerse: urlInfo.hashParts[2] || "1",
      onChange: onBibleReferenceChange,
      addOBS: true,
    });
  bibleReferenceActions.applyBooksFilter("obs");

  useEffect(() => {
    const loadMarkdownFiles = async () => {
      let markdownFiles = [];
      for (let i = 1; i < 51; ++i) {
        const filename = `${catalogEntry.repo.name}/content/${`${i}`.padStart(2, "0")}.md`;
        if (filename in zipFileData.files) {
          markdownFiles.push(await zipFileData.files[filename]?.async("text"));
        } else {
          markdownFiles.push(`# ${i}. STORY NOT FOUND!\n\n`);
        }
      }
      setStoriesMarkdown(markdownFiles);
    };

    if (catalogEntry && zipFileData) {
      loadMarkdownFiles();
    }
  }, [catalogEntry, zipFileData]);

  useEffect(() => {
    if (!html && storiesMarkdown) {
      let html = `<h1 style="text-align: center">${catalogEntry.title}</h1>\n`;
      const md = markdownit();
      storiesMarkdown.forEach((storyMarkdown, i) => {
        html += `<div id="obs-${i + 1}-1">${md.render(storyMarkdown)}</div>`;
      });
      setHtml(html);
    }
  }, [storiesMarkdown, html]);

  useEffect(() => {
    if (html) {
      Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise((resolve) => {
                img.onload = img.onerror = resolve;
              })
          )
      ).then(() => {
        bibleReferenceActions.goToBookChapterVerse(
          bibleReferenceState.bookId,
          bibleReferenceState.chapter,
          bibleReferenceState.verse
        );
      });
    }
  }, [html]);

  return (
    <BibleReference
      status={bibleReferenceState}
      actions={bibleReferenceActions}
    />
  )
}

RcTranslationWords.propTypes = {
  urlInfo: PropTypes.object,
  catalogEntry: PropTypes.object,
  zipFileData: PropTypes.object,
  updateUrlHashInAddressBar: PropTypes.func,
  setErrorMessage: PropTypes.func,
  setCanChangeColumns: PropTypes.func,
  setHtml: PropTypes.func,
};
