import markdownit from 'markdown-it'

export default async function convertRcOpenBibleStories(catalogEntry, zipFileData) {
    let markdownFiles = []
    let obsRootPath = ""
    catalogEntry.ingredients.forEach(ingredient => {
        if(ingredient.identifier == "obs") {
            obsPath = `${catalogEntry.repo.name}/${ingredient.path}`
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
    storiesMarkdown.forEach((storyMarkdown, i) => {
        html += `<div id="obs-${i+1}-1">${md.render(storyMarkdown)}</div>`
    })
    return html
}
