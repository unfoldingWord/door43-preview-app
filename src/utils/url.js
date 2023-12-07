export const updateUrlHotlink = (urlInfo) => {
    if (urlInfo) {
        const params = new URLSearchParams(window.location.search)
        window.history.replaceState({id: "100"}, '', decodeURIComponent(`/u/${urlInfo?.owner}/${urlInfo?.repo}/${urlInfo?.ref}/${urlInfo?.extraPath.join("/")}${params.size ? `?${params}` : ''}`))
    }  
}