const constructUrl = urlInfo => {
    if (urlInfo) {
        const params = new URLSearchParams(window.location.search)
        return decodeURIComponent(`/u/${urlInfo?.owner}/${urlInfo?.repo}/${urlInfo?.extraPath.join("/")}${params.size ? `?${params}` : ''}`)
    }
}

export const updateUrlHotlink = urlInfo => {
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