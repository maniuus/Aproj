const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests',
  testMatch: /ui.*\.spec\.js$/,
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled'
    }
  },
  reporter: [['list']],
  outputDir: 'test-results'
})
