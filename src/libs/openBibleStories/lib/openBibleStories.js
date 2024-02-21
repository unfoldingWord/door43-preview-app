import markdownit from 'markdown-it'

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
    let html = `<h1 style="text-align: center" id="obs">${catalogEntry.title}</h1>\n`

    let frontFilePath = `${obsRootPath}/front.md`
    if (frontFilePath in zipFileData.files) {
        html += `<artcile class="obs-front"><span class="header-anchor" id="obs-front"></span>${md.render(await zipFileData.file(frontFilePath).async('text'))}</article>`
    } else {
        frontFilePath = `${obsRootPath}/front/intro.md`
        if (frontFilePath in zipFileData.files) {
            html += `<artcile class="obs-front"><span class="header-anchor" id="obs-front"></span>${md.render(await zipFileData.file(frontFilePath).async('text'))}</article>`
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
        html += `<section id="obs-${storyIdx+1}" class="story">`
        frames.forEach((frame, frameIdx) => {
            frame = frame.trim()
            const link = `obs-${storyIdx+1}-${frameIdx}`
            if (frameIdx == 0) {
                let header = frame.trim()
                if (!header) {
                    header = "# [NO TITLE]"
                }
                html += `<article class="obs-story-header">${md.render(header)}<span class="header-anchor" id="${link}-header"></span></article>`
            } else {
                html += `<article class="obs-story-frame"><span class="header-anchor" id="${link}"></span>${md.render(frame)}</article>`
            }
        })
        html += `</section>`
    })

    let backFilePath = `${obsRootPath}/back.md`
    if (backFilePath in zipFileData.files) {
        html += `<artcile class="obs-back"><span class="header-anchor" id="obs-back"></span>${md.render(await zipFileData.file(backFilePath).async('text'))}</article>`
    } else {
        backFilePath = `${obsRootPath}/back/intro.md`
        if (frontFilePath in zipFileData.files) {
            html += `<artcile class="obs-black"><span class="header-anchor" id="obs-back"></span>${md.render(await zipFileData.file(backFilePath).async('text'))}</article>`
        }
    }
 
    return html
}
