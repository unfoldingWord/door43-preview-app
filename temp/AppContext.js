import { RepositoryApi, OrganizationApi, CatalogApi } from 'dcs-js';




useEffect(() => {
  const addResourceFromRoute = async () => {
    const info = router.query.ownerRepoRefBook
    if (info.length < 2) {
      return
    }
    const owner = info[0]
    const repo = info[1]
    let ref = info[2]
    let bookId = info[3]
    let content = null
    let repoObj = null
    if (!ref) {
      repoObj = await repoClient.repoGet({owner, repo}).then(({ data }) => data)
      console.log(repoObj)
      if (repoObj != null) {
        ref = repoObj.default_branch
      }
      console.log("REF", ref)
    }
    const catalogEntry = await catalogClient.catalogGetEntry({owner, repo, tag: ref}).then(({ data }) => data)
    if (! catalogEntry) {
      content = `Unable to find this resource on DCS: ${owner}/${repo}/src/branch/${ref || "master"}`
    } else if (!bookId && catalogEntry.ingredients.length > 0) {
      for(let i = 0; i < catalogEntry.ingredients.length; i++) {
        if (catalogEntry.ingredients[i].identifier != "frt") {
          bookId = catalogEntry.ingredients[i].identifier
          break
        }
      }
    }
    let _books = [...books]
    let _entry = { 
      id: `${bookId}-${owner}/${repo}/${ref}`,
      owner,
      repo,
      ref,
      catalogEntry,
      bookId,
      source: "dcs",
      content,
      showCard: true,
      readOnly: true,
    }
    let found = -1
    let showCardChange = false
    for (let i=0; i<_books.length; i++) {
      if ( _books[i].id === _entry.id ) {
        if ( _books[i].showCard ) {
          found = i
        } else { 
          if (_books[i]?.showCard === false ) {
            found = i 
            _books[i].showCard = true
            showCardChange = true
          }
        }
        break
      }
    }
    setNewBibleBook(_entry.bookId)
    if ( found > -1 ) {
      if ( showCardChange ) {
        _setBooks(_books) // update to reflect change above
      }
    } else {
      _books.push(_entry)
      _setBooks(_books)
    }
  }

  if (router.query.ownerRepoRefBook && repoClient && catalogClient) {
    addResourceFromRoute()
  }
}, [router.query.ownerRepoRefBook, repoClient, catalogClient])


