export default {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'mobile',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  },
}
