// React imports
import { useState, useEffect, useContext } from 'react'

// Material UI imports
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material'

// Bible reference component and hook
import { useBibleReference } from 'bible-reference-rcl'
import BibleReference from 'bible-reference-rcl'

// DCS API helper
import { getRepoContentsContent } from '@helpers/dcsApi'

// Custom hooks
import useFetchRelationCatalogEntries from '@hooks/useFetchRelationCatalogEntries'
import useFetchCatalogEntryBySubject from '@hooks/useFetchCatalogEntriesBySubject'
import useGetOBSData from '../hooks/useGetOBSData'
import useFetchZipFileData from '@hooks/useFetchZipFileData'
import useGenerateTranslationAcademyFileContents from '@hooks/useGenerateTranslationAcademyFileContents'

// Markdown parser
import MarkdownIt from 'markdown-it'

// HTML helper
import { encodeHTML } from '@helpers/html'

// App context
import { AppContext } from '@components/App.context'

// OBS helper
import { getOBSImgURL } from '../helpers/obs_helpers'

// TSV parser
import { parseTsv7Text } from '@core/lib/tsv'

const webCss = `
article img {
  display: block;
  margin: 0 auto;
  width: 100%;
  max-width: 640px;
}

.obs-tn-entry h1 {
  font-size: 1.4em;
  margin: 10px 0;
}

.obs-tn-entry h2 {
  font-size: 1.2em;
  margin: 10px 0;
}

.obs-tn-entry h3 {
  font-size: 1.1em;
  margin: 10px 0;
}

.obs-tn-entry h4 {
  font-size: 1.0em;
  margin: 10px 0;
}

@media print {
  section.obs-tn-story-frame,
  section.story-frame{
    break-after: page;
  }

  article {
    break-after: avoid-page !important;
  }

  hr {
    break-before: avoid-page !important;
  }

  .ta.appendex article {
    break-after: page !important;
  }  
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

.ta.appendex .article-body h1, .article-body h2, .article-body h3, .article-body h4 {
  font-size: 1em;
}

.title-page {
  text-align: center;
}
`

export default function RcObsTranslationNotes() {
  const {
    state: {
      urlInfo,
      catalogEntry,
    },
    actions: {
      setWebCss,
      setErrorMessage,
      setHtmlSections,
      setDocumentAnchor,
      setStatusMessage,
    },
  } = useContext(AppContext)

  const [imageResolution, setImageResolution] = useState('360px');

  const [tsvText, setTsvText] = useState()

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
  }

  const onBibleReferenceChange = (b, c, v) => {
    setDocumentAnchor(`${b}-${c}-${v}`)
  }

  const { state: bibleReferenceState, actions: bibleReferenceActions } =
    useBibleReference({
      initialBook: "obs",
      initialChapter: urlInfo.hashParts[1] || "1",
      initialVerse: urlInfo.hashParts[2] || "1",
      onChange: onBibleReferenceChange,
      addOBS: true,
    })

  const relationCatalogEntries = useFetchRelationCatalogEntries({
    catalogEntry,
    setErrorMessage,
  })

  const obsCatalogEntry = useFetchCatalogEntryBySubject({
    catalogEntries: relationCatalogEntries,
    subject: "Open Bible Stories",
    setErrorMessage,
  })

  const obsZipFileData = useFetchZipFileData({
    catalogEntry: obsCatalogEntry,
    setErrorMessage,
  })

  const obsData = useGetOBSData({
    catalogEntry: obsCatalogEntry,
    zipFileData: obsZipFileData,
    setErrorMessage,
  })

  const taCatalogEntry = useFetchCatalogEntryBySubject({
    catalogEntries: relationCatalogEntries,
    subject: "Translation Academy",
    setErrorMessage,
  })

  const taZipFileData = useFetchZipFileData({
    catalogEntry: taCatalogEntry,
    setErrorMessage,
  })

  const taFileContents = useGenerateTranslationAcademyFileContents({
    catalogEntry: taCatalogEntry,
    zipFileData: taZipFileData,
    setErrorMessage,
  })

  useEffect(() => {
    bibleReferenceActions.applyBooksFilter("obs")
    setWebCss(webCss)
  }, [])

  useEffect(() => {
    const fetchTsvFileFromDCS = async () => {
      let filePath = ""
      catalogEntry.ingredients.forEach(ingredient => {
        if (ingredient.identifier == "obs" || ingredient.identifier == "obs-tn") {
          filePath = ingredient.path.replace(/^\.\//, "")
        }
      })
      if (! filePath) {
        setErrorMessage(`Project \`obs\` is not in repo's project list.`)
      }

      getRepoContentsContent(catalogEntry.repo.url, filePath, catalogEntry.commit_sha).
      then(tsv => setTsvText(tsv)).
      catch(e => {
        console.log(`Error calling getRepoContentsContent(${catalogEntry.repo.url}, ${filePath}, ${catalogEntry.commit_sha}): `, e)
        setErrorMessage(`Unable to get content for tn_OBS.tsv from DCS`)
      })
    }

    if (catalogEntry) {
      setStatusMessage(<>Preparing preview for {catalogEntry.title}.<br/>Please wait...</>)
      fetchTsvFileFromDCS()
    }
  }, [catalogEntry, setErrorMessage])

  useEffect(() => {
    const generateHtml = async () => {
      const tsv7Data = await parseTsv7Text(tsvText);

      let html = `
<section class="obs-tn-story" id="obs-tn" data-toc-title="${encodeHTML(catalogEntry.title)}">
  <h1 style="text-align: center">${catalogEntry.title}</h1>
`
      const md = new MarkdownIt()
      const supportReferences = {}
      let noteCount = 0

      for(let storyIdx = 0; storyIdx < 51; storyIdx++) {
        storyNum = storyIdx+1

        html += `
  <section class="obs-tn-story" id="obs-${storyNum}" data-toc-title="${encodeHTML(obsData.stories[storyIdx].title)}">
    <h2 class="obs-tn-story-header"><a href="#obs-${storyNum}">${obsData.stories[storyIdx].title}</h2>
`

        for(let frameIdx in obsData.stories[storyIdx].frames) {
          const frameNum = frameIdx+1
          const frame = obsData.stories[storyIdx].frames[frameIdx]
          const link = `obs-${storyNum}-${frameNum}`
          html += `
    <section class="obs-tn-story-frame-section" id="${link}">
      <article class="obs-tn-frame-obs-text" id="obs-${storyNum}-${frameNum}-obs-text">
          <img src="${getOBSImgURL(frame.imgURL, imageResolution)}" alt="${frame.image}" />
`
        }



        if (!row || !row.ID || !row.Note) {
          continue
        }
        noteCount++
        let storyStr = row.Reference.split(":")[0]
        let frameStr = row.Reference.split(":")[1]
        let firstFrame = frameStr.split(",")[0].split("-")[0].split("–")[0]
        
        let storyIdx = -1
        let frameIdx = -1
        try {
          storyIdx = parseInt(storyStr, 10) - 1;
          if (storyIdx >= 0) {
            storyStr = storyStr.padStart(2, "0")
          }
        } catch (e) {
          console.log(e)
        }
        try {
          frameIdx = parseInt(firstFrame, 10) - 1;
          if (frameIdx >= 0) {
            firstFrame = firstFrame.padStart(2, "0")
          }
        } catch(e) {
          console.log(e)
        }

        if (! (storyStr in articlesByStoryFrame)) {
          articlesByStoryFrame[storyStr] = {
            title: obsData?.stories?.[storyIdx].title || storyStr,
            frames: {}
          }
        }
        if (! (firstFrame in articlesByStoryFrame[storyStr].frames)) {
          articlesByStoryFrame[storyStr].frames[firstFrame] = {
            title: `OBS ${storyStr}:${firstFrame}`,
            topArticle: "",
            articles: [],
          }

          if (obsData.stores?.storyIdx?.frames?.[frameIdx]?.content) {
            if (storyIdx >= 0 && obsData.stories.length > storyIdx && frameIdx >= 0 && obsData.stories[storyIdx].frames.length > frameIdx) {
              let topArticle = `
        <article class="obs-tn-story" id="obs-${storyStr}-${frameStr}-story">
          <h2 class="obs-tn-story-frame-header">
            <a href="#obs-${storyStr}-${frameStr}" class="header-link">OBS ${storyStr}:${firstFrame}</a>  
          </h2>
          <div class="obs-tn-story-frame">
  `
              if (! imageResolution || imageResolution != "none") {
                topArticle += `
            <img src="${await getOBSImgURL({storyNum: storyIdx+1, frameNum: frameIdx+1, imgURL: obsData.stories[storyIdx].frames[frameIdx].imgURL, resolution: imageResolution})}" />
  `
              }
              topArticle += `
            <p>
              ${obsData.stories[storyIdx].frames[frameIdx].content}
            </p>
          </div>
          <hr style="width: 75%"/>
        </article>
  `
              articlesByStoryFrame[storyStr].frames[firstFrame].topArticle = topArticle
        }
        let article = `
        <article class="obs-tn-entry" id="${link}">
          <h3 class="obs-tn-entry-header">
            <a class="header-link" href="#${link}">
              Note #${noteCount}:
            </a>
          </h3>
  `
          if ((storyStr != "front" || frameStr != "intro" || frameStr != "0") && (row.GLQuote || row.Quote)) {
            html += `
          <h4>Quote: ${frameStr != firstFrame ? `(${storyStr}:${frameStr}) ` : ""}${row.GLQuote || row.Quote}</h4>
  `
          }
          if (row.SupportReference) {
            if (! (row.SupportReference in supportReferences)) {
                const srParts = row.SupportReference.split('/')
                const manualId = srParts[srParts.length - 2]
                const articleId = srParts[srParts.length - 1]
                supportReferences[row.SupportReference] = {
                  backRefs: [],
                  title: articleId,
                  body: "TA ARTICLE NOT FOUND",
                  link: `note--${manualId}--${articleId}`
                }
                if (manualId in taFileContents && articleId in taFileContents[manualId].articles) {
                  supportReferences[row.SupportReference] = {...supportReferences[row.SupportReference], ...taFileContents[manualId].articles[articleId]}
                }
            }
            supportReferences[row.SupportReference].backRefs.push(`<a href="#${link}">${row.Reference}</a>`)
            html += `
          <div class="obs-tn-entry-support-reference">
            <span style="font-weight: bold">Topic:</span>&nbsp; <a href="#${supportReferences[row.SupportReference].link}">${supportReferences[row.SupportReference].title}</a>
          </div>
  `
          }
          let note = md.render(row.Note.replaceAll("\\n", "\n").replaceAll("<br>", "\n"))
          note = note.replace(/href="\.\/0*([^/".]+)(\.md){0,1}"/g, `href="#obs-${storyStr}-$1"`)
          note = note.replace(/href="\.\.\/0*([^/".]+)\/0*([^/".]+)(\.md){0,1}"/g, `href="#obs-$1-$2"`)
          note = note.replace(/href="0*([^#/".]+)(\.md){0,1}"/g, `href="#obs-${storyStr}-$1"`)
          note = note.replace(/href="\/*0*([^#/".]+)\/0*([^/".]+)\.md"/g, `href="#obs-$1-$2"`)
          note = note.replace(/(?<![">])(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/g, '<a href="$1">$1</a>')
          note = note.replace(/(href="http[^"]+")/g, '$1 target="_blank"')
  
          note = note.replace()
          html += `
          <span class="header-title">OBS :: ${obsData.stories[storyIdx].title} :: ${row.Reference}</span>
          <div class="obs-tn-entry-body">
            ${note}
          </div>
          <hr style="width: 75%"/>
        </article>
  `        
        articlesByStoryFrame[storyStr].frames[firstFrame].articles.push(article)
      }

      let html = `
<section data-toc-title="${encodeHTML(catalogEntry.title)}">
`
      for (let storyStr in sort(Object.keys(articlesByStoryFrame))) {
        html += `
  <section class="obs-tn-story" id="obs-${storyStr}" data-toc-title="${encodeHTML(articlesByStoryFrame[storyStr].title)}">
    <h2 class="obs-tn-story-header"><a href="#obs-${storyStr}">${articlesByStoryFrame[storyStr].title}</h2>
    <a href="#obs-${storyStr}-front" class="header-link"></a>
`
        if (prevStory && storyStr != prevStory) {
          html += `
    </section>
  </section>
`
        }
        if (storyStr != prevStory || firstFrame != prevFrame) {
          if (storyStr == prevStory) {
            html += `
    </section>
`
          }
          if(storyStr != prevStory) {
            html += `
    <section class="obs-tn-story-section" id="obs-${storyStr}" data-toc-title="${encodeHTML(obsData.stories[storyIdx].title)}">
      <h2 class="obs-tn-story-header">${obsData.stories[storyIdx].title}</h2>
      <span class="header-title">OBS :: ${obsData.stories[storyIdx].title}</span>
    </section>
`
          }
          html += `
    <section class="obs-tn-story-frame-section" id="obs-${storyStr}-${firstFrame}">
`
            html += article
          }
        }

        const link = `obs-${storyStr}-${frameStr}-${row.ID}`
        html += `
      <article class="obs-tn-entry" id="${link}">
        <h3 class="obs-tn-entry-header">
          <a class="header-link" href="#${link}">
            Note #${noteCount}:
          </a>
        </h3>

`
        if ((storyStr != "front" || frameStr != "intro" || frameStr != "0") && (row.GLQuote || row.Quote)) {
          html += `
        <h4>Quote: ${frameStr != firstFrame ? `(${storyStr}:${frameStr}) ` : ""}${row.GLQuote || row.Quote}</h4>
`
        }
        if (row.SupportReference) {
          if (! (row.SupportReference in supportReferences)) {
              const srParts = row.SupportReference.split('/')
              const manualId = srParts[srParts.length - 2]
              const articleId = srParts[srParts.length - 1]
              supportReferences[row.SupportReference] = {
                backRefs: [],
                title: articleId,
                body: "TA ARTICLE NOT FOUND",
                link: `note--${manualId}--${articleId}`
              }
              if (manualId in taFileContents && articleId in taFileContents[manualId].articles) {
                supportReferences[row.SupportReference] = {...supportReferences[row.SupportReference], ...taFileContents[manualId].articles[articleId]}
              }
          }
          supportReferences[row.SupportReference].backRefs.push(`<a href="#${link}">${row.Reference}</a>`)
          html += `
        <div class="obs-tn-entry-support-reference">
          <span style="font-weight: bold">Topic:</span>&nbsp; <a href="#${supportReferences[row.SupportReference].link}">${supportReferences[row.SupportReference].title}</a>
        </div>
`
        }
        let note = md.render(row.Note.replaceAll("\\n", "\n").replaceAll("<br>", "\n"))
        note = note.replace(/href="\.\/0*([^/".]+)(\.md){0,1}"/g, `href="#obs-${storyStr}-$1"`)
        note = note.replace(/href="\.\.\/0*([^/".]+)\/0*([^/".]+)(\.md){0,1}"/g, `href="#obs-$1-$2"`)
        note = note.replace(/href="0*([^#/".]+)(\.md){0,1}"/g, `href="#obs-${storyStr}-$1"`)
        note = note.replace(/href="\/*0*([^#/".]+)\/0*([^/".]+)\.md"/g, `href="#obs-$1-$2"`)
        note = note.replace(/(?<![">])(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/g, '<a href="$1">$1</a>')
        note = note.replace(/(href="http[^"]+")/g, '$1 target="_blank"')

        note = note.replace()
        html += `
        <span class="header-title">OBS :: ${obsData.stories[storyIdx].title} :: ${row.Reference}</span>
        <div class="obs-tn-entry-body">
          ${note}
        </div>
        <hr style="width: 75%"/>
      </article>
`
        prevStory = storyStr
        prevFrame = firstFrame
      }

      html += `
    </section>
  </section>
</section>
<section class="appendex ta" id="notes-ta" data-toc-title="${encodeHTML(taCatalogEntry.title)}">
  <article class="title-page">
    <span class="header-title"></span>
    <img class="title-logo" src="https://cdn.door43.org/assets/uw-icons/logo-uta-256.png" alt="uta">
    <h1 class="cover-header section-header">${taCatalogEntry.title}</h1>
    <h3 class="cover-version">${taCatalogEntry.branch_or_tag_name}</h3>
  </article>  
`
      Object.values(supportReferences).sort((a, b) => a.title.toLowerCase() < b.title.toLowerCase() ? -1 : a.title.toLowerCase() > b.title.toLowerCase() ? 1 : 0).forEach(taArticle => {
        html += `
  <article id="${taArticle.link}" data-toc-title="${encodeHTML(taArticle.title)}">
    <h2 class="header article-header">
      <a href="#${taArticle.link}" class="header-link">${taArticle.title}</a>
    </h2>
    <span class="header-title">${taCatalogEntry.title} :: ${taArticle.title}</span>
    <div class="article-body">
      ${taArticle.body}
    </div>
    <div class="back-refs">
    <h3>OBS References:</h3>
    ${taArticle.backRefs.join('; ')}
    <hr style="width: 75%" />
  </article>
`
      })
      html += `
</section>
`
      setHtmlSections({cover: "", toc: "", body: html})
    }

    if (tsvText && obsData && taFileContents) {
      generateHtml()
    }
  }, [tsvText, obsData, taFileContents, imageResolution, setHtmlSections])

  return (
    <>
      <BibleReference
        status={bibleReferenceState}
        actions={bibleReferenceActions}
        style={{minWidth: "auto"}}
      />
      <FormControl>
        <InputLabel id="image-resolution-label">
          Images
        </InputLabel>
        <Select
          labelId="image-resolution-label"
          label="Images"
          value={imageResolution}
          onChange={(event) => setImageResolution(event.target.value)}>
          <MenuItem value="none">Hide Images</MenuItem>
          <MenuItem value="360px">640x360px</MenuItem>
          <MenuItem value="2160px">3840x2160px</MenuItem>
        </Select>
      </FormControl>
    </>
  )
}
