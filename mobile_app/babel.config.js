// NativeWind v4 needs its own babel preset alongside Expo's, plus the
// jsxImportSource pragma so `className` props get compiled to styles — same
// role Tailwind's Vite plugin plays for the web app, just at the Babel
// transform layer instead of a bundler plugin (RN has no CSS pipeline).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
