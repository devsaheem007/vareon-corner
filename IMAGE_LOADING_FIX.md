# PG MOTORS image loading fix

- Vehicle URLs now use Wikimedia Commons `Special:FilePath` rather than the previous redirect endpoint.
- Every `<img>` uses `alt`, async decoding, and lazy loading except the active hero image.
- If a remote vehicle image is unavailable, the UI shows a clean branded PG MOTORS vehicle placeholder instead of a broken-image icon.
- The old unrelated Unsplash hero preload was removed so the browser does not download an unnecessary image before rendering.
- No loading screen or artificial spinner is used.

For fully offline/local deployment, download the licensed vehicle photographs into `public/cars/` and replace the `image` URLs in `src/App.tsx` with `/cars/<filename>.jpg` paths.
