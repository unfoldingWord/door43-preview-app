import markdownit from 'markdown-it'

export default async function convertRcOpenBibleStories(catalogEntry, zipFileData) {
    let markdownFiles = []
    let obsRootPath = ""
    catalogEntry.ingredients.forEach(ingredient => {
        if(ingredient.identifier == "obs") {
            obsRootPath = `${catalogEntry.repo.name}/${ingredient.path.replace(/^\.\//, "")}`
        }
    })
    if (! obsRootPath) {
        throw new Error("Unable to find an obs project in the manfiest.yaml file.")
    }

    for (let i = 1; i < 51; ++i) {
      const obsStoryFilePath = `${obsRootPath}/${`${i}`.padStart(2, '0')}.md`
      if (obsStoryFilePath in zipFileData.files) {
          markdownFiles.push(await zipFileData.file(obsStoryFilePath).async('text'))
      } else {
          markdownFiles.push(`# ${i}. STORY NOT FOUND!\n\n`)
      }
    }

    let html = `<h1 style="text-align: center">${catalogEntry.title}</h1>\n`
    const md = markdownit()
    markdownFiles.forEach((storyMarkdown, storyIdx) => {
        const frames = storyMarkdown.split(/(?=\!\[)/g) // Spliting on image markdown
        const header = frames.shift()
        frames[0] = header + frames?.[0]
        frames.forEach((frame, frameIdx) => {
            html += `<article id="obs-${storyIdx+1}-${frameIdx+1}" class="break-inside: avoid">${md.render(frame)}</article>`
        })
    })

    return html
}
