const constructUrl = urlInfo => {
    if (urlInfo) {
        const params = new URLSearchParams(window.location.search)
        return decodeURIComponent(`/u/${urlInfo?.owner}/${urlInfo?.repo}/${urlInfo?.ref}${params.size ? `?${params}` : ''}${urlInfo?.hashParts.length ? `#${urlInfo.hashParts.join('-')}` : ''}`)
    }
}

export const updateUrlHashLink = hashData => {
    window.location.hash = hashData.join('-')
}
