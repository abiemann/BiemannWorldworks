# Biemann Worldworks

The public [Biemann Worldworks website](https://abiemann.github.io/BiemannWorldworks/) introduces Velvet Sky for Meta Quest with in-app screenshots and a 30-second trailer. The [Velvet Sky privacy policy](https://abiemann.github.io/BiemannWorldworks/privacy/) covers the app, support correspondence and this website.

GitHub Pages serves the static site from the root of the main branch. To preview locally, serve this directory with any static HTTP server and open the home page. Use the links in the page footer to review the privacy policy and sky imagery credits.

## Location QR generator

Use the memorable [is.gd/vtsky](https://is.gd/vtsky) shortcut, or the direct [abiemann.github.io/BiemannWorldworks/gps/](https://abiemann.github.io/BiemannWorldworks/gps/) address. Name the place, press **Use my location** and grant permission, or enter signed decimal coordinates manually. Desktop browsers may give coarse estimates; reported accuracy is displayed. Press **Generate QR code** and scan the result in Velvet Sky's **A → Location → Enter GPS → Scan QR**. Scanning fills the form for review; **Save** applies it. A phone and laptop both work, and optical scanning needs no shared Wi-Fi network.

The free is.gd shortcut redirects directly to the generator, with detailed statistics enabled. Its [public redirect statistics](https://is.gd/stats.php?url=vtsky) count accesses to this shortcut, not all website visits or unique people; automated requests and repeat visits can be included. is.gd may report browser, country and referring-page information, and keeps IP information for abuse prevention under [its privacy policy](https://is.gd/privacy.php). No place name or coordinates appear in the shortcut. Its target cannot be changed later, so retain the stable GitHub route and direct link as a fallback. The older [is.gd/velvetsky](https://is.gd/velvetsky) alias still works with its original detailed statistics off.

QR generation runs locally using the bundled [Nayuki library and license](gps/vendor/NOTICE.txt). Names/coordinates are not uploaded, added to URLs, or saved by the page. Downloading explicitly creates a location-bearing PNG. Anyone with the QR can read its location.

To check statistics, bookmark [https://is.gd/stats.php?url=vtsky](https://is.gd/stats.php?url=vtsky). **No account, username or password is needed.** The report is public and free to view.

Version 1 payload is plain text: `DV=1&LAT=47.6062095&LON=-122.3320708&Name=Seattle+balcony`. There are exactly four case-sensitive fields; names and values use UTF-8 form encoding. Only finite in-range coordinates and trimmed single-line names of 1–64 UTF-16 characters are accepted, matching the app. The generator clears a stale code whenever its inputs change. Geolocation is requested only from the button, times out after 15 seconds and offers retry/manual entry on errors.

## Publishing

The website has no added page-visit counter. The app itself remains offline and has no analytics service. Deployment requires committing/pushing this repository's changes to main; changes in the VelvetSky app repository do not publish this website.

## Checks

Run `node --test tests/location.test.cjs`. Seven tests execute the shipped event handlers with unit DOM doubles and the real bundled QR encoder. They cover the five shared protocol fixtures, geolocation success and reported accuracy, denied/unavailable/timed-out fixes and retry, insecure/unsupported browsers, editing while a fix is pending, invalid fields, stale-code clearing and PNG download data. A fallback-form check ensures no named controls can place input values into a native GET URL if scripts fail. These tests use synthetic fixes; they do not claim a real phone GPS fix or browser permission trial. Separate browser checks verified desktop/320-pixel layouts and QR rendering, and actual canvas PNGs decoded to the exact expected payload with ZXing. The Quest camera also read the public Seattle fixture and the app's existing Save flow applied it. Full physical device/browser acceptance is separate from these checks.
