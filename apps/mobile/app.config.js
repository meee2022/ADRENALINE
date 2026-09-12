// Explicit opt-in test profile; normal builds retain app.json unchanged.
module.exports = ({ config }) => {
  if (process.env.ADRENALINE_TEST_PROFILE !== 'development') return config;
  const siteUrl = process.env.ADRENALINE_TEST_SITE_URL;
  if (!siteUrl || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(siteUrl)) {
    throw new Error('Development test profile requires a loopback test website URL.');
  }
  return {
    ...config,
    name: 'Adrenaline DEV TEST',
    extra: {
      ...config.extra,
      convexUrl: 'https://rightful-parakeet-660.convex.cloud',
      siteUrl,
      subscriberPushEnabled: false,
      subscriberOverviewEnabled: false,
      testProfile: 'development',
    },
  };
};
