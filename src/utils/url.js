const constructUrl = urlInfo => {
    if (urlInfo) {
        const params = new URLSearchParams(window.location.search)
        return decodeURIComponent(`/u/${urlInfo?.owner}/${urlInfo?.repo}/${urlInfo?.ref}${params.size ? `?${params}` : ''}${urlInfo?.hashParts.length ? `#${urlInfo.hashParts.join('-')}` : ''}`)
    }
}

export const updateUrlHashLink = urlInfo => {
    const url = constructUrl(urlInfo)
    if (url) {
        window.history.replaceState({id: "100"}, '', url)
    }  
}

export const redirectToUrl = urlInfo => {
    const url = constructUrl(urlInfo)
    if (url) {
        window.location.href = url
    }
}