/**
 * Sheet access. One sheet per entity, header row fixed by CONFIG.SHEETS.
 */
var SheetService = (function () {

  function book() {
    var id = prop_('SPREADSHEET_ID');
    return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  }

  function ensure(name) {
    var ss = book(), sh = ss.getSheetByName(name);
    var headers = CONFIG.SHEETS[name];
    if (!headers) throw new Error('unknown sheet: ' + name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      return sh;
    }
    /* Widen an existing sheet rather than rewriting it, so a sheet the
       customer already added columns to is left alone. */
    var have = sh.getLastColumn()
      ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String)
      : [];
    var missing = headers.filter(function (h) { return have.indexOf(h) < 0; });
    if (missing.length) {
      sh.getRange(1, have.length + 1, 1, missing.length).setValues([missing]);
      sh.setFrozenRows(1);
    }
    return sh;
  }

  function ensureAll() {
    Object.keys(CONFIG.SHEETS).forEach(ensure);
  }

  function headers(sh) {
    return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  }

  function readAll(name) {
    var sh = ensure(name);
    if (sh.getLastRow() < 2) return { headers: headers(sh), rows: [] };
    var head = headers(sh);
    var values = sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues();
    var rows = values.map(function (r, i) {
      var o = { __row: i + 2 };
      head.forEach(function (h, c) { o[h] = r[c]; });
      return o;
    });
    return { headers: head, rows: rows };
  }

  /* Upsert by id. Last write wins on updatedAt, matching the client, except
     that a row the server has never seen is always inserted. */
  function upsert(name, idCol, records) {
    var sh = ensure(name);
    var head = headers(sh);
    var existing = readAll(name);
    var byId = {};
    existing.rows.forEach(function (r) { byId[String(r[idCol])] = r; });

    var appends = [], applied = [], skipped = [];

    records.forEach(function (rec) {
      var id = String(rec[idCol] || '');
      if (!id) { skipped.push({ id: '', why: 'missing id' }); return; }
      var row = head.map(function (h) { return Utils.safeCell(rec[h]); });
      var cur = byId[id];
      if (!cur) {
        appends.push(row);
        applied.push(id);
      } else if (Utils.num(rec.updatedAt) >= Utils.num(cur.updatedAt)) {
        sh.getRange(cur.__row, 1, 1, head.length).setValues([row]);
        applied.push(id);
      } else {
        skipped.push({ id: id, why: 'older' });
      }
    });

    if (appends.length) {
      sh.getRange(sh.getLastRow() + 1, 1, appends.length, head.length).setValues(appends);
    }
    return { applied: applied, skipped: skipped };
  }

  function since(name, ts) {
    var data = readAll(name);
    return data.rows.filter(function (r) {
      return Utils.num(r.updatedAt) > Utils.num(ts);
    }).map(function (r) { delete r.__row; return r; });
  }

  function append(name, rec) {
    var sh = ensure(name);
    var head = headers(sh);
    sh.appendRow(head.map(function (h) { return Utils.safeCell(rec[h]); }));
  }

  return { ensure: ensure, ensureAll: ensureAll, readAll: readAll,
           upsert: upsert, since: since, append: append, book: book };
})();
