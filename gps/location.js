(function (root) {
  "use strict";

  const MAX_NAME_LENGTH = 64;
  const MAX_PAYLOAD_LENGTH = 2048;
  const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

  function validUnicode(value) {
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(++i);
        if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      } else if (code >= 0xdc00 && code <= 0xdfff) return false;
    }
    return true;
  }

  function coordinate(value, limit) {
    const text = String(value == null ? "" : value).trim();
    if (!DECIMAL.test(text)) return null;
    const number = Number(text);
    return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
  }

  function timeZone(value) {
    const zone = String(value == null ? "" : value).trim();
    if (zone !== "UTC" && !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/.test(zone)) return null;
    try { new Intl.DateTimeFormat("en", { timeZone: zone }); return zone; }
    catch (_) { return null; }
  }

  function deviceTimeZone() {
    try { return timeZone(Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC"; }
    catch (_) { return "UTC"; }
  }

  function validate(draft) {
    const name = String(draft.name == null ? "" : draft.name).trim();
    const latitude = coordinate(draft.latitude, 90);
    const longitude = coordinate(draft.longitude, 180);
    const zone = timeZone(draft.timeZone == null ? deviceTimeZone() : draft.timeZone);
    const errors = {};
    if (!name) errors.name = "Give this place a name.";
    else if (name.length > MAX_NAME_LENGTH) errors.name = "Use a name with 64 characters or fewer.";
    else if (CONTROL.test(name) || !validUnicode(name)) errors.name = "Use a single-line place name with valid text.";
    if (latitude === null) errors.latitude = "Enter latitude between -90 and 90.";
    if (longitude === null) errors.longitude = "Enter longitude between -180 and 180.";
    if (zone === null) errors.zone = "Choose a valid region time zone, such as America/Los_Angeles.";
    return Object.keys(errors).length ? { value: null, errors: errors } : { value: { name: name, latitude: latitude, longitude: longitude, timeZone: zone }, errors: errors };
  }

  function encode(draft) {
    const result = validate(draft);
    if (!result.value) throw new Error("A valid named location is required.");
    const value = result.value;
    const payload = new URLSearchParams({ DV: "1", LAT: String(value.latitude), LON: String(value.longitude), Name: value.name, TZ: value.timeZone }).toString();
    if (payload.length > MAX_PAYLOAD_LENGTH) throw new Error("This location code is too long.");
    return payload;
  }

  const protocol = Object.freeze({ MAX_NAME_LENGTH: MAX_NAME_LENGTH, MAX_PAYLOAD_LENGTH: MAX_PAYLOAD_LENGTH, validate: validate, encode: encode });
  if (typeof module === "object" && module.exports) module.exports = protocol;
  root.VelvetSkyLocation = protocol;
  if (typeof document === "undefined") return;

  const form = document.getElementById("location-form");
  const fields = { name: document.getElementById("location-name"), latitude: document.getElementById("latitude"), longitude: document.getElementById("longitude"), zone: document.getElementById("time-zone") };
  const locate = document.getElementById("use-location");
  const locationStatus = document.getElementById("location-status");
  const accuracy = document.getElementById("location-accuracy");
  const manual = document.getElementById("manual-coordinates");
  const result = document.getElementById("qr-result");
  const empty = document.getElementById("qr-empty");
  const qrStatus = document.getElementById("qr-status");
  const canvas = document.getElementById("qr-canvas");
  let qr = null;
  let request = 0;
  fields.zone.value = deviceTimeZone();
  const choices = document.getElementById("time-zones");
  const zones = new Set(["UTC", fields.zone.value]);
  if (typeof Intl.supportedValuesOf === "function") {
    Intl.supportedValuesOf("timeZone").forEach(function (zone) { zones.add(zone); });
  }
  Array.from(zones).sort().forEach(function (zone) {
    const option = document.createElement("option"); option.value = zone; choices.appendChild(option);
  });

  function clearError(key) {
    const message = document.getElementById(key + "-error");
    message.hidden = true;
    message.textContent = "";
    fields[key].removeAttribute("aria-invalid");
  }

  function invalidate() {
    qr = null;
    result.hidden = true;
    empty.hidden = false;
    document.getElementById("qr-payload").value = "";
    qrStatus.textContent = "";
  }

  Object.keys(fields).forEach(function (key) {
    fields[key].addEventListener("input", function () {
      clearError(key);
      invalidate();
      if (key === "latitude" || key === "longitude") {
        request++;
        locate.disabled = false;
        locate.textContent = "Use my location";
        accuracy.hidden = true;
        locationStatus.textContent = "Using the coordinates you enter.";
      }
    });
  });

  function currentPosition() {
    return new Promise(function (resolve, reject) {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
  }

  locate.addEventListener("click", async function () {
    const token = ++request;
    invalidate();
    accuracy.hidden = true;
    if (!navigator.geolocation || !root.isSecureContext) {
      locationStatus.textContent = "This browser cannot find your location here. You can enter coordinates below instead.";
      manual.open = true;
      return;
    }
    locate.disabled = true;
    locationStatus.textContent = "Finding your location…";
    try {
      const position = await currentPosition();
      if (token !== request) return;
      const checked = validate({ name: "Location", latitude: position.coords.latitude, longitude: position.coords.longitude });
      if (!checked.value) throw new Error("Invalid coordinates");
      fields.latitude.value = String(checked.value.latitude);
      fields.longitude.value = String(checked.value.longitude);
      clearError("latitude");
      clearError("longitude");
      invalidate();
      locationStatus.textContent = "Received Location -> Click 'Generate QR code'";
      if (Number.isFinite(position.coords.accuracy) && position.coords.accuracy >= 0) {
        accuracy.textContent = "Reported accuracy: approximately " + Math.ceil(position.coords.accuracy).toLocaleString() + " metres.";
        accuracy.hidden = false;
      }
      locate.textContent = "Refresh my location";
    } catch (error) {
      if (token !== request) return;
      const messages = {
        1: "Location permission was not granted. Allow location in your browser and try again, or enter coordinates below.",
        2: "Your browser could not find your location. Try again, or enter coordinates below.",
        3: "Finding your location took too long. Try again, or enter coordinates below."
      };
      locationStatus.textContent = messages[error.code] || "Your location could not be read. Try again, or enter coordinates below.";
      locate.textContent = "Try location again";
      manual.open = true;
    } finally {
      if (token === request) locate.disabled = false;
    }
  });

  function draw() {
    if (!qr) return;
    const border = 4;
    const modules = qr.size + border * 2;
    const available = Math.min(448, document.getElementById("qr-wrap").clientWidth);
    const ratio = Math.max(1, root.devicePixelRatio || 1);
    const scale = Math.max(1, Math.floor(available * ratio / modules));
    canvas.width = canvas.height = modules * scale;
    canvas.style.width = canvas.style.height = (modules * scale / ratio) + "px";
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#000000";
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.getModule(x, y)) context.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
      }
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const checked = validate({ name: fields.name.value, latitude: fields.latitude.value, longitude: fields.longitude.value, timeZone: fields.zone.value });
    Object.keys(fields).forEach(clearError);
    invalidate();
    if (!checked.value) {
      Object.keys(checked.errors).forEach(function (key) {
        const message = document.getElementById(key + "-error");
        message.textContent = checked.errors[key];
        message.hidden = false;
        fields[key].setAttribute("aria-invalid", "true");
      });
      if (checked.errors.latitude || checked.errors.longitude) manual.open = true;
      fields[Object.keys(checked.errors)[0]].focus();
      return;
    }
    try {
      const payload = encode(checked.value);
      qr = qrcodegen.QrCode.encodeText(payload, qrcodegen.QrCode.Ecc.MEDIUM);
      fields.name.value = checked.value.name;
      fields.zone.value = checked.value.timeZone;
      document.getElementById("result-name").textContent = checked.value.name;
      document.getElementById("qr-payload").value = payload;
      canvas.setAttribute("aria-label", "Location QR code for " + checked.value.name);
      empty.hidden = true;
      result.hidden = false;
      draw();
      qrStatus.textContent = "Your code is ready to scan in Velvet Sky.";
    } catch (_) {
      invalidate();
      qrStatus.textContent = "The QR code could not be created. Please reload this page and try again.";
    }
  });

  document.getElementById("download-qr").addEventListener("click", function () {
    if (!qr) return;
    const link = document.createElement("a");
    link.download = "velvet-sky-location.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
  root.addEventListener("resize", draw);
})(typeof globalThis !== "undefined" ? globalThis : this);
