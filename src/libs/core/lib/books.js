import { BibleBookData } from "../../../common/books"

// supported books are books that are both in the ingredients of a catalog entry and have existing files in zip file
export const getSupportedBooks = (catalogEntry, fileList = null) => {
    let supportedBooks = []
    catalogEntry.ingredients.forEach(ingredient => {
        const id = ingredient.identifier
        if(!(id in BibleBookData)) {
            return
        }
        if (fileList) {
            if (fileList.includes(ingredient.path.replace(/^\.\//, ""))) {
                supportedBooks.push(id)
            }
        } else {
            supportedBooks.push(id)
        }
    })
    return supportedBooks
}