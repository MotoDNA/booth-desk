/**
 * Shared helpers. Kept free of Apps Script services where possible so the
 * logic can be unit-tested outside the editor.
 */
var Utils = (function () {

  /* A cell beginning with = + - @ is executed as a formula by Sheets and by
     Excel when the sheet is exported. Everything written from the app is
     visitor-supplied text, so it is neutralised on the way in. */
  function safeCell(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    var s = String(v);
    return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  }

  function asList(v) {
    if (Array.isArray(v)) return v.join(' / ');
    return v === null || v === undefined ? '' : String(v);
  }

  function parseList(v) {
    if (!v) return [];
    return String(v).split('/').map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function isEmail(v) {
    return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  }

  /* Ids come from the device and are echoed into sheet formulas and logs, so
     they are restricted rather than trusted. */
  function isId(v) {
    return typeof v === 'string' && v.length > 0 && v.length <= 64 && /^[A-Za-z0-9_\-]+$/.test(v);
  }

  function num(v, dflt) {
    var n = Number(v);
    return isFinite(n) ? n : (dflt === undefined ? 0 : dflt);
  }

  function ok(data) {
    return { success: true, data: data === undefined ? null : data, error: null,
             timestamp: new Date().toISOString() };
  }

  function fail(code, message) {
    return { success: false, data: null, error: { code: code, message: String(message || '') },
             timestamp: new Date().toISOString() };
  }

  /* A plain [] lookup on an object literal also finds inherited keys, so
     'constructor' and '__proto__' pass an "is it a known name?" check and
     'constructor' is even callable. Every dispatch table is read through
     this instead. */
  function own(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : null;
  }

  return { own: own, safeCell: safeCell, asList: asList, parseList: parseList,
           isEmail: isEmail, isId: isId, num: num, ok: ok, fail: fail };
})();
