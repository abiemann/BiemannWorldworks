"use strict";
// Unit tests execute the shipped event handlers against minimal in-memory DOM doubles.
// Actual browser layout, optical scanning and headset input are verified separately.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const site = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(site, "gps/location.js"), "utf8");
const vendor = fs.readFileSync(path.join(site, "gps/vendor/qrcodegen.js"), "utf8");

function page(options = {}) {
  const elements = new Map();
  const pending = [];
  const anchors = [];
  class Element {
    constructor() {
      this.value = ""; this.textContent = ""; this.hidden = false;
      this.disabled = false; this.open = false; this.style = {};
      this.attrs = {}; this.events = {}; this.clientWidth = 280;
      this.children = [];
    }
    addEventListener(name, callback) { this.events[name] = callback; }
    removeAttribute(name) { delete this.attrs[name]; }
    setAttribute(name, value) { this.attrs[name] = value; }
    focus() { this.focused = true; }
    fire(name) { return this.events[name]({ preventDefault() {} }); }
    getContext() { return { fillRect() {}, imageSmoothingEnabled: true }; }
    toDataURL(type) { assert.equal(type, "image/png"); return "data:image/png;base64,unit-test-png"; }
    click() { this.clicked = true; }
    appendChild(child) { this.children.push(child); }
  }
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const navigator = {};
  if (options.geolocation !== false) navigator.geolocation = {
    getCurrentPosition(success, failure, settings) { pending.push({ success, failure, settings }); }
  };
  const context = {
    URLSearchParams, navigator, isSecureContext: options.secure !== false, devicePixelRatio: 2,
    document: {
      getElementById: get,
      createElement(tag) {
        assert.ok(tag === "a" || tag === "option");
        const element = new Element(); if (tag === "a") anchors.push(element); return element;
      }
    },
    addEventListener() {}
  };
  vm.createContext(context);
  vm.runInContext(vendor, context);
  vm.runInContext(source, context);
  get("qr-result").hidden = true;
  const fill = () => {
    get("location-name").value = "Seattle balcony";
    get("latitude").value = "47.6062095";
    get("longitude").value = "-122.3320708";
  };
  return { get, pending, anchors, protocol: context.VelvetSkyLocation, fill };
}

test("five shared browser/app fixtures preserve UTF-8 names, punctuation and signed coordinates", () => {
  const { protocol } = page();
  const lines = fs.readFileSync(path.join(__dirname, "location-qr-v1.tsv"), "utf8").trimEnd().split(/\r?\n/).slice(1);
  assert.equal(lines.length, 5);
  for (const line of lines) {
    const [name, latitude, longitude, payload] = line.split("\t");
    const encoded = protocol.encode({ name, latitude, longitude });
    assert.equal(encoded.split("&TZ=")[0], payload);
    assert.ok(new URLSearchParams(encoded).get("TZ"));
    assert.equal(new URLSearchParams(payload).get("Name"), name);
  }
});

test("geolocation waits for a gesture, reports accuracy and re-enables refresh", async () => {
  const p = page();
  p.get("location-name").value = "My place";
  assert.equal(p.pending.length, 0);
  const done = p.get("use-location").fire("click");
  assert.equal(p.get("use-location").disabled, true);
  assert.equal(p.pending[0].settings.timeout, 15000);
  assert.equal(p.pending[0].settings.maximumAge, 0);
  p.pending[0].success({ coords: { latitude: 47.6062095, longitude: -122.3320708, accuracy: 12.2 } });
  await done;
  assert.equal(p.get("latitude").value, "47.6062095");
  assert.equal(p.get("longitude").value, "-122.3320708");
  assert.equal(p.get("location-name").value, "My place");
  assert.match(p.get("location-accuracy").textContent, /13 metres/);
  assert.equal(p.get("location-accuracy").hidden, false);
  assert.equal(p.get("use-location").disabled, false);
  assert.equal(p.get("use-location").textContent, "Refresh my location");
});

test("permission denied, unavailable and timeout offer manual entry and a working retry", async () => {
  for (const [code, message] of [[1, /permission/], [2, /could not find/], [3, /too long/]]) {
    const p = page();
    const done = p.get("use-location").fire("click");
    p.pending[0].failure({ code }); await done;
    assert.match(p.get("location-status").textContent, message);
    assert.equal(p.get("manual-coordinates").open, true);
    assert.equal(p.get("use-location").disabled, false);
    assert.equal(p.get("use-location").textContent, "Try location again");
    const retry = p.get("use-location").fire("click");
    p.pending[1].success({ coords: { latitude: 0, longitude: 0, accuracy: 25 } }); await retry;
    assert.equal(p.get("latitude").value, "0");
    assert.equal(p.get("location-status").textContent, "Received Location -> Click 'Generate QR code'");
  }
});

test("unsupported or insecure geolocation remains a manual-only form", async () => {
  for (const options of [{ geolocation: false }, { secure: false }]) {
    const p = page(options); await p.get("use-location").fire("click");
    assert.equal(p.pending.length, 0);
    assert.equal(p.get("manual-coordinates").open, true);
    assert.match(p.get("location-status").textContent, /enter coordinates/);
  }
});

test("editing coordinates cancels a pending fix so its late result cannot overwrite them", async () => {
  const p = page(); const done = p.get("use-location").fire("click");
  p.get("latitude").value = "-33.8"; p.get("latitude").fire("input");
  p.get("longitude").value = "151.2"; p.get("longitude").fire("input");
  p.pending[0].success({ coords: { latitude: 47, longitude: -122, accuracy: 2 } }); await done;
  assert.equal(p.get("latitude").value, "-33.8");
  assert.equal(p.get("longitude").value, "151.2");
  assert.equal(p.get("use-location").disabled, false);
  assert.equal(p.get("location-accuracy").hidden, true);
  assert.match(p.get("location-status").textContent, /coordinates you enter/);
});

test("empty, invalid names and coordinate ranges stay inline; valid code is cleared on edit", () => {
  const p = page();
  p.get("location-form").fire("submit");
  assert.equal(p.get("location-name").attrs["aria-invalid"], "true");
  assert.equal(p.get("manual-coordinates").open, true);
  p.fill(); p.get("location-name").value = "x".repeat(65);
  p.get("location-form").fire("submit");
  assert.match(p.get("name-error").textContent, /64/);
  p.fill(); p.get("latitude").value = "90.1";
  p.get("location-form").fire("submit");
  assert.match(p.get("latitude-error").textContent, /-90 and 90/);
  assert.equal(p.get("qr-result").hidden, true);
  p.fill(); p.get("location-form").fire("submit");
  assert.equal(p.get("qr-result").hidden, false);
  assert.equal(p.get("qr-empty").hidden, true);
  assert.match(p.get("qr-payload").value, /^DV=1&LAT=47/);
  assert.ok(p.get("qr-canvas").width > 0);
  p.get("download-qr").fire("click");
  assert.equal(p.anchors.length, 1);
  assert.equal(p.anchors[0].download, "velvet-sky-location.png");
  assert.match(p.anchors[0].href, /^data:image\/png;base64,/);
  assert.equal(p.anchors[0].clicked, true);
  p.get("location-name").value = "New name"; p.get("location-name").fire("input");
  assert.equal(p.get("qr-result").hidden, true);
  assert.equal(p.get("qr-payload").value, "");
  p.get("download-qr").fire("click");
  assert.equal(p.anchors.length, 1);
});

test("failed or disabled JavaScript cannot submit named inputs into a navigation URL", () => {
  const html = fs.readFileSync(path.join(site, "gps/index.html"), "utf8");
  const controls = html.match(/<(?:input|textarea|select)\b[^>]*>/gi) || [];
  assert.ok(controls.length >= 3);
  for (const control of controls) assert.doesNotMatch(control, /\bname\s*=/i);
});

test("time-zone fixtures share the exact encoded IANA identifier with the app", () => {
  const { protocol } = page();
  const lines = fs.readFileSync(path.join(__dirname, "location-qr-timezones.tsv"), "utf8").trimEnd().split(/\r?\n/).slice(1);
  assert.equal(lines.length, 5);
  for (const line of lines) {
    const [name, latitude, longitude, timeZone, payload] = line.split("\t");
    assert.equal(protocol.encode({ name, latitude, longitude, timeZone }), payload);
    assert.equal(new URLSearchParams(payload).get("TZ"), timeZone);
  }
});

test("a visible device-zone default is selectable and changing it clears the prior QR", () => {
  const p = page();
  assert.ok(p.get("time-zone").value);
  assert.ok(p.get("time-zones").children.length > 1);
  p.fill(); p.get("time-zone").value = "Pacific/Auckland";
  p.get("location-form").fire("submit");
  assert.equal(new URLSearchParams(p.get("qr-payload").value).get("TZ"), "Pacific/Auckland");
  p.get("time-zone").value = "America/Los_Angeles"; p.get("time-zone").fire("input");
  assert.equal(p.get("qr-result").hidden, true);
  assert.equal(p.get("qr-payload").value, "");
  p.get("location-form").fire("submit");
  assert.equal(new URLSearchParams(p.get("qr-payload").value).get("TZ"), "America/Los_Angeles");
});

test("invalid or abbreviated zones stay inline and cannot generate a misleading QR", () => {
  for (const zone of ["", "PST", "Mars/Olympus", "+01:00", "America/Los_Angeles\nInvalid"]) {
    const p = page(); p.fill(); p.get("time-zone").value = zone;
    p.get("location-form").fire("submit");
    assert.equal(p.get("qr-result").hidden, true);
    assert.equal(p.get("time-zone").attrs["aria-invalid"], "true");
    assert.match(p.get("zone-error").textContent, /time zone/);
  }
});
