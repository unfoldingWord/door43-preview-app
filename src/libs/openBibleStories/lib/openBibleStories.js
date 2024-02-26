import markdownit from 'markdown-it'
import { encodeHTML } from '@utils/html'

export default async function convertOpenBibleStories(catalogEntry, zipFileData) {
    let markdownFiles = []
    let obsRootPath = ""
    if (!catalogEntry || !catalogEntry.ingredients) {
        throw new Error("No valid ingredeints found in this resource to render.")
    }
    catalogEntry.ingredients.forEach(ingredient => {
        if(ingredient.identifier == "obs") {
            obsRootPath = `${catalogEntry.repo.name.toLowerCase()}/${ingredient.path.replace(/^\.\//, "")}`
        }
    })
    if (! obsRootPath) {
        throw new Error("Unable to find an obs project in the manfiest.yaml file.")
    }

    const md = markdownit()
    let html = `
<section id="obs" data-toc-title="${encodeHTML(catalogEntry.title)}">
`

    let frontFilePath = `${obsRootPath}/front.md`
    let copyright = ""
    if (frontFilePath in zipFileData.files) {
        copyright = `
<artcile class="obs-front" id="obs-front" data-toc-title"Front">
    ${md.render(await zipFileData.file(frontFilePath).async('text'))}
</article>`
    } else {
        frontFilePath = `${obsRootPath}/front/intro.md`
        if (frontFilePath in zipFileData.files) {
            copyright = `
<artcile class="obs-front" id="obs-front" data-toc-title"Front">
    ${md.render(await zipFileData.file(frontFilePath).async('text'))}
</article>`
        }
    }

    for (let i = 1; i < 51; ++i) {
      const obsStoryFilePath = `${obsRootPath}/${`${i}`.padStart(2, '0')}.md`
      if (obsStoryFilePath in zipFileData.files) {
          markdownFiles.push(await zipFileData.file(obsStoryFilePath).async('text'))
      } else {
          markdownFiles.push(`# ${i}. [STORY NOT FOUND]\n\n`)
      }
    }

    markdownFiles.forEach((storyMarkdown, storyIdx) => {
        const frames = storyMarkdown.split(/(?=\!\[)/g) // Spliting on image markdown
        let title = frames.shift().trim().replace(/^#+ */, '')
        if (!title) {
            title = "[NO TITLE]"
        }
        html += `
<section id="obs-${storyIdx+1}" class="story" data-toc-title="${encodeHTML(title)}">
  <h1 class="obs-story-title title">${title}</h1>
`
        frames.forEach((frame, frameIdx) => {
            frame = frame.trim()
            const link = `obs-${storyIdx+1}-${frameIdx+1}`
            html += `
<article class="obs-story-frame" id="${link}">
    ${md.render(frame)}
</article>`
        })
        html += `</section>`
    })

    let backFilePath = `${obsRootPath}/back.md`
    if (backFilePath in zipFileData.files) {
        html += `
<artcile class="obs-back" id="obs-back">
    ${md.render(await zipFileData.file(backFilePath).async('text'))}
</article>
`
    } else {
        backFilePath = `${obsRootPath}/back/intro.md`
        if (frontFilePath in zipFileData.files) {
            html += `
<artcile class="obs-black" id="obs-back">
    ${md.render(await zipFileData.file(backFilePath).async('text'))}
</article>
`
        }
    }
    html += '</section>'
 
    return {copyright, body: html}
}
