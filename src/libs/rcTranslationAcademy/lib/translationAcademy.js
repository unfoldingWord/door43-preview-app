import markdownit from 'markdown-it'

export default async function convertTranslationAcademy(catalogEntry, zipFileData) {
    let markdownFiles = []
    let obsRootPath = ""
    catalogEntry.ingredients.forEach(ingredient => {
        if(ingredient.identifier == "obs") {
            obsRootPath = `${catalogEntry.repo.name.toLowerCase()}/${ingredient.path.replace(/^\.\//, "")}`
        }
    })
    if (! obsRootPath) {
        throw new Error("Unable to find an obs project in the manfiest.yaml file.")
    }

    const md = markdownit()
    let html = `<h1 style="text-align: center">${catalogEntry.title}</h1>\n`

    let frontFilePath = `${obsRootPath}/front.md`
    if (frontFilePath in zipFileData.files) {
        html += `<artcile id="obs-front">${md.render(await zipFileData.file(frontFilePath).async('text'))}</article>`
    } else {
        frontFilePath = `${obsRootPath}/front/intro.md`
        if (frontFilePath in zipFileData.files) {
            html += `<artcile id="obs-front">${md.render(await zipFileData.file(frontFilePath).async('text'))}</article>`
        }
    }

    for (let i = 1; i < 51; ++i) {
      const obsStoryFilePath = `${obsRootPath}/${`${i}`.padStart(2, '0')}.md`
      if (obsStoryFilePath in zipFileData.files) {
          markdownFiles.push(await zipFileData.file(obsStoryFilePath).async('text'))
      } else {
          markdownFiles.push(`# ${i}. STORY NOT FOUND!\n\n`)
      }
    }

    markdownFiles.forEach((storyMarkdown, storyIdx) => {
        const frames = storyMarkdown.split(/(?=\!\[)/g) // Spliting on image markdown
        const header = frames.shift()
        frames[0] = header + frames?.[0]
        frames.forEach((frame, frameIdx) => {
            html += `<article id="obs-${storyIdx+1}-${frameIdx+1}" class="break-inside: avoid">${md.render(frame)}</article>`
        })
    })

    let backFilePath = `${obsRootPath}/back.md`
    if (backFilePath in zipFileData.files) {
        html += `<artcile id="obs-back">${md.render(await zipFileData.file(backFilePath).async('text'))}</article>`
    } else {
        backFilePath = `${obsRootPath}/back/intro.md`
        if (frontFilePath in zipFileData.files) {
            html += `<artcile id="obs-front">${md.render(await zipFileData.file(backFilePath).async('text'))}</article>`
        }
    }

    return html
}
