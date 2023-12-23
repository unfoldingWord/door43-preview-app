export const updateUrlHashInAddressBar = hashParts => {
    if (hashParts) {
        window.history.replaceState({id: "100"}, '', `${window.location.href.split('#')[0]}#${hashParts.join('-')}`)
    }
}
