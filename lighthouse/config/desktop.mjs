import desktopConfig from 'lighthouse/core/config/desktop-config.js'

export default {
  ...desktopConfig,
  settings: {
    ...desktopConfig.settings,
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  },
}
