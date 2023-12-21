import { BibleBookData } from "../../../common/books"

// supported books are books that are both in the ingredients of a catalog entry and have existing files in zip file
export const getSupportedBooks = (catalogEntry, zipFileData) => {
    let supportedBooks = []
    catalogEntry.ingredients.forEach(ingredient => {
        const id = ingredient.identifier
        if(!(id in BibleBookData)) {
            return
        }
        const filePath = `${catalogEntry.repo.name}/${ingredient.path.replace(/^\.\//, "")}`
        if(filePath in zipFileData.files) {
            supportedBooks.push(id)
        }
    })
    return supportedBooks
}