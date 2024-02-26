import { useState, useEffect } from 'react'
import markdownit from 'markdown-it'
import yaml from 'yaml'

const manualIDs = ['kt', 'names', 'other']

const manualTitles = {
  kt: "Key Terms",
  names: "Names",
  other: "Other",
}

export default function useGenerateTranslationWordsManuals({
  catalogEntry,
  zipFileData,
  setErrorMessage,
}) {
  const [twFileContents, setTwFileContents] = useState()
  const [twManuals, setTwManuals] = useState()

  useEffect(() => {
    const getFileContents = async () => {
      const articleMap = {}
      manualIDs.forEach((manualID, i) => {
        const manualPath = `${catalogEntry.repo.name.toLowerCase()}/bible/${manualID}`
        if (! (manualPath + "/" in zipFileData.files)) {
          return
        }
        articleMap[manualID] = {
          id: manualID,
          sort: i,
          title: manualTitles[manualID],
          articles : {},
        }
      })
      const entries = Object.keys(zipFileData.files).
        filter(name => name.split('/').slice(2, 3) in articleMap && name.endsWith('.md')).
        map(name => zipFileData.files[name])
      const listOfPromises = entries.map(entry => entry.async("uint8array").then(u8 => [entry.name, u8]))
      const promiseOfList = Promise.all(listOfPromises);
      const md = markdownit({
        html: true,
        linkify: true,
        typographer: true
      })
      promiseOfList.then(list => {
        list.reduce((accumulator, current) => {
          const currentName = current[0]
          const currentValue = current[1]
          const nameParts = currentName.split('/')
          const manualId = nameParts[2]
          const articleId = nameParts[3].split('.')[0]
          if (! (articleId in articleMap[manualId].articles)) {
            articleMap[manualId].articles[articleId] = {
              id: articleId,
            }
          }
          let text = new TextDecoder().decode(currentValue).trim()
          text = text.replace(/\(+rc:\/\/([^/]+)\/([^/]+)\/([^/]+)\/([A-Za-z0-9_\/-]+)\)+/g, function (match, lang, id, type, rest) { 
            if (rest.startsWith("obs/")) {
              id = "obs"
            }
            return `https://preview.door43.org/u/${catalogEntry.owner}/${catalogEntry.language}_${id}/#${rest.replace(/\/0/g, '/').replace(/\//g, '-')})`;
          })
          let body = md.render(text)
          body = body.replace(/href="\.\/([^/".]+)(\.md){0,1}"/g, `href="#${manualId}--$1"`)
          body = body.replace(/href="\.\.\/([^/".]+)\/([^/".]+)(\.md){0,1}"/g, `href="#$1--$2"`)
          body = body.replace(/href="([^#/".]+)(\.md){0,1}"/g, `href="#${manualId}--$1"`)
          body = body.replace(/href="\/*([^#/".]+)\/([^/".]+)\.md"/g, `href="#$1--$2"`)
          body = body.replace(/(?<![">])(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/g, '<a href="$1">$1</a>')
          body = body.replace(/(href="http[^"]+")/g, '$1 target="_blank"')
          articleMap[manualId].articles[articleId].title = text.split('\n')[0].replace(/^#+ *(.*?) *#*/, '$1')
          articleMap[manualId].articles[articleId].body = body
        }, {})
        setTwFileContents(articleMap)
      })
    }

    if(catalogEntry && zipFileData) {
      getFileContents()
    }
  }, [catalogEntry, zipFileData])
  
  const addPropertiesToTocSections = (manual, sections) => {
    if (! sections || ! sections.length) {
        return sections
    }
    for(let i = 0; i < sections.length; i++) {
        sections[i].id = sections[i].link
        sections[i].manual_id = manual.id
        sections[i].toctitle = sections[i].title
        if (!sections[i].link && sections[i].title) {
            sections[i].link = 'section-'+sections[i].title.replace(/\W+/g, "-").toLowerCase()
            sections[i].body = ""
        } else {
            if (sections[i].link in twFileContents[manual.id].articles) {
                sections[i].title = twFileContents[manual.id].articles[sections[i].link].title
                sections[i].body = twFileContents[manual.id].articles[sections[i].link].body
            }
        }
        sections[i].link = `${manual.id}--${sections[i].link}`
        sections[i].sections = addPropertiesToTocSections(manual, sections[i].sections)
    }
    return sections
  }

  useEffect(() => {
    const getAllManualSections = async () => {
        const allManualSections = []
        Object.values(twFileContents).sort((a, b) => a.sort > b.sort ? 1 : b.title > a.title ? -1 : 0).forEach(manual => {
            const manualTopSection = {
                id: manual.id,
                manual_id: manual.id,
                link: `${manual.id}--${manual.id}`,
                sections: [],
                title: manual.title,
            }
            if (manual.toc && Object.keys(manual.toc).length) {
              manualTopSection.sections = addPropertiesToTocSections(manualTopSection, manual.toc.sections)
            } else {
              Object.values(manual.articles).sort((a, b) => a.title > b.title ? 1 : b.title > a.title ? -1 : 0 ).forEach(article => {
                manualTopSection.sections.push({
                  id: article.id,
                  manual_id: manualTopSection.id,
                  link: `${manual.id}--${article.id}`,
                  title: article.title,
                  toctitle: article.title,
                  body: article.body,
                })
              })
            }
            allManualSections.push(manualTopSection)
        })
        setTwManuals(allManualSections)
    }

    if(twFileContents) {
      getAllManualSections()
    }
  }, [twFileContents])

  return twManuals
}
