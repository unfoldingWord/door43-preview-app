import packagefile from '../../package.json'

export const APP_VERSION = packagefile.version
export const APP_NAME = 'Door43 Preview'
export const DCS_SERVERS = {
    'prod': {baseUrl: 'https://git.door43.org', ID: 'PROD'},
    'qa': {baseUrl: 'https://qa.door43.org', ID: 'QA'},
    'dev': {baseUrl: 'https://develop.door43.org', ID: 'DEV'},
}
export const API_PATH  = 'api/v1'
export const DEFAULT_OWNER = 'unfoldingWord'

export const DISABLE_NAVIGATION_BUTTON = true
