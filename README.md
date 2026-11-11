# Biemann Worldworks

The public [Biemann Worldworks website](https://abiemann.github.io/BiemannWorldworks/) introduces Velvet Sky for Meta Quest with in-app screenshots and a 30-second trailer. The [Velvet Sky privacy policy](https://abiemann.github.io/BiemannWorldworks/privacy/) covers the app, support correspondence and this website.

GitHub Pages serves the static site from the root of the main branch. To preview locally, serve this directory with any static HTTP server and open the home page. Use the links in the page footer to review the privacy policy and sky imagery credits.

## Location QR generator

[abiemann.github.io/BiemannWorldworks/gps/](https://abiemann.github.io/BiemannWorldworks/gps/) is the shortest route in this existing GitHub Pages project. A custom shorter domain can be added later. Name the place, press **Use my location** and grant permission, or enter signed decimal coordinates manually. Desktop browsers may give coarse estimates; reported accuracy is displayed. Press **Generate QR code** and scan the result in Velvet Sky's **A → Location → Enter GPS → Scan QR**. Scanning fills the form for review; **Save** applies it. A phone and laptop both work, and optical scanning needs no shared Wi-Fi network.

QR generation runs locally using the bundled [Nayuki library and license](gps/vendor/NOTICE.txt). Names/coordinates are not uploaded, added to URLs, or saved by the page. Downloading explicitly creates a location-bearing PNG. Anyone with the QR can read its location.

Version 1 payload is plain text: `DV=1&LAT=47.6062095&LON=-122.3320708&Name=Seattle+balcony`. There are exactly four case-sensitive fields; names and values use UTF-8 form encoding. Only finite in-range coordinates and trimmed single-line names of 1–64 UTF-16 characters are accepted, matching the app. The generator clears a stale code whenever its inputs change. Geolocation is requested only from the button, times out after 15 seconds and offers retry/manual entry on errors.

## Anonymous page counts

`visits.js` sends one fixed, credential-free, no-referrer request per home/generator page load to the account-free [Hits](https://github.com/silentsoft/hits) badge endpoint. It sends no form data, name, coordinates or user identifier; does not load third-party scripts; and skips local previews, Do Not Track and Global Privacy Control. Failure never blocks QR generation. The provider's [badge privacy statement](https://hits.sh/privacy/) says it does not track IP addresses, use cookies or collect user agents. Its separate statistics site uses Google Analytics. The public totals are approximate requests including repeats and possible bots, not unique visitors or app installs.

View aggregate statistics without incrementing the badge:

- [Home page statistics](https://hits.sh/abiemann.github.io/BiemannWorldworks/)
- [QR generator statistics](https://hits.sh/abiemann.github.io/BiemannWorldworks/gps/)

The app itself remains offline and has no analytics service. Update the privacy policy when changing the counter or location data flow. Deployment requires committing/pushing this repository's changes to main; changes in the VelvetSky app repository do not publish this website.

## Checks

Run `node --test tests/location.test.cjs`. Nine tests execute the shipped event handlers with unit DOM doubles and the real bundled QR encoder. They cover the five shared protocol fixtures, geolocation success and reported accuracy, denied/unavailable/timed-out fixes and retry, insecure/unsupported browsers, editing while a fix is pending, invalid fields, stale-code clearing, PNG download data and fixed anonymous counter routes. A fallback-form check ensures no named controls can place input values into a native GET URL if scripts fail. These tests use synthetic fixes; they do not claim a real phone GPS fix or browser permission trial. Separate browser checks verified desktop/320-pixel layouts and QR rendering, and actual canvas PNGs decoded to the exact expected payload with ZXing. The Quest camera also read the public Seattle fixture and the app's existing Save flow applied it. Full physical device/browser acceptance is separate from these checks.
