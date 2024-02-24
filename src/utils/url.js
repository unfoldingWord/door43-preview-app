export const updateUrlHashInAddressBar = hash => {
    if (hash) {
        window.history.replaceState({id: "100"}, '', `${window.location.href.split('#')[0]}#${hash}`)
    }
}
