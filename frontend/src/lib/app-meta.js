// Keep the official distribution discoverable even when somebody builds the APK locally
// without passing VITE_GITHUB_OWNER/VITE_GITHUB_REPO. Forks can still override both values.
export const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER || 'Truesilverking'
export const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || 'TGym'
export const APP_REPOSITORY = GITHUB_OWNER ? `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}` : ''
export const UPDATE_MANIFEST_URL = import.meta.env.VITE_UPDATE_MANIFEST_URL || (GITHUB_OWNER ? `https://${GITHUB_OWNER}.github.io/${GITHUB_REPO}/updates/latest.json` : '')
export const APP_DISTRIBUTION = import.meta.env.VITE_APP_DISTRIBUTION || (import.meta.env.VITE_STANDALONE === '1' ? 'pwa' : 'github')
export const ORIGINAL_OPENGYM_REPOSITORY = 'https://gitlab.com/DuarteSantos8/opengym'
