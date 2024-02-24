import { useState, useEffect } from 'react'
import markdownit from 'markdown-it'
import yaml from 'yaml'


export default function useGenerateTranslationAcademyManuals({
  catalogEntry,
  zipFileData,
  setErrorMessage,
}) {
  const [taFileContents, setTaFileContents] = useState()
  const [taManuals, setTaManuals] = useState()

  useEffect(() => {
    const getFileContents = async () => {
      const articleMap = {}
      catalogEntry.ingredients.sort((a, b) => a.sort > b.sort ? 1 : b.sort > a.sort ? -1 : 0).forEach((ingredient, i) => {
        const manualPath = `${catalogEntry.repo.name.toLowerCase()}/${ingredient.path.replace(/^\.\//, "")}`
        if (! (manualPath + "/" in zipFileData.files)) {
          setErrorMessage(`Manual given in manifest file does not exist: ${ingredient.identifer}`)
          return
        }
        articleMap[ingredient.identifier] = {
          id: ingredient.identifier,
          sort: ingredient.sort ? ingredient.sort : i,
          title: ingredient.title,
          articles : {},
          toc: null,
          config: null,
        }
      })
      const entries = Object.keys(zipFileData.files).
        filter(name => name.split('/').slice(1, 2) in articleMap && (name.endsWith('01.md') || name.endsWith('title.md') || name.endsWith('sub-title.md') || name.endsWith("toc.yaml") || name.endsWith("config.yaml"))).
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
          const manualId = nameParts[1]
          if (nameParts[2].endsWith("toc.yaml")) {
            articleMap[manualId].toc = yaml.parse(new TextDecoder().decode(currentValue))
            return
          }
          if (nameParts[2].endsWith("config.yaml")) {
            articleMap[manualId].config = yaml.parse(new TextDecoder().decode(currentValue))
            return
          }
          const articleId = nameParts[2]
          if (! (articleId in articleMap[manualId].articles)) {
            articleMap[manualId].articles[articleId] = {
              id: articleId,
            }
          }
          switch(nameParts[3]) {
            case "title.md":
              articleMap[manualId].articles[articleId].title = new TextDecoder().decode(currentValue).trim()
              return
            case "sub-title.md":
              articleMap[manualId].articles[articleId].subtitle = new TextDecoder().decode(currentValue).trim()
              return
            case "01.md":
            default:
              let body = md.render(new TextDecoder().decode(currentValue))
              body = body.replace(/href="\.\.\/([^/".]+)\/*(01.md){0,1}"/g, `href="#${manualId}--$1"`)
              body = body.replace(/href="\.\.\/\.\.\/([^/".]+)\/([^/".]+)\/*(01.md){0,1}"/g, `href="#$1--$2"`)
              body = body.replace(/(?<![">])(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/g, '<a href="$1">$1</a>')
              body = body.replace(/(href="http[^"]+")/g, '$1 target="_blank"')
              articleMap[manualId].articles[articleId].body = body
          }
        }, {})
        setTaFileContents(articleMap)
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
            if (sections[i].link in taFileContents[manual.id].articles) {
                sections[i].title = taFileContents[manual.id].articles[sections[i].link].title
                sections[i].body = taFileContents[manual.id].articles[sections[i].link].body
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
        Object.values(taFileContents).sort((a, b) => a.sort > b.sort ? 1 : b.title > a.title ? -1 : 0).forEach(manual => {
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
        setTaManuals(allManualSections)
    }

    if(taFileContents) {
      getAllManualSections()
    }
  }, [taFileContents])

  return taManuals
}
