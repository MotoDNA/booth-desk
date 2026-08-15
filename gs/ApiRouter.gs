/**
 * Request envelope, auth and dispatch (spec 52, 53).
 *
 * Every reply is {success, data, error, timestamp} and always HTTP 200:
 * Apps Script turns a thrown error into an HTML page the app cannot parse.
 */
var ApiRouter = (function () {

  var ACTIONS = {
    ping:            function () { return Utils.ok({ pong: true, version: '3.0' }); },
    setup:           function ()  { SheetService.ensureAll(); return Utils.ok({ sheets: Object.keys(CONFIG.SHEETS) }); },
    sync:            function (p, ctx) { return SyncService.sync(p, ctx.deviceId); },
    generateLeadAnalysis: function (p) { return Utils.ok(AIService.run('lead_analysis', p)); }
  };

  function reply_(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  }

  function parse_(e) {
    if (!e || !e.postData || !e.postData.contents) return null;
    try { return JSON.parse(e.postData.contents); } catch (err) { return null; }
  }

  function handle(e) {
    var body = parse_(e);
    if (!body) return reply_(Utils.fail('INVALID_REQUEST', 'body is not JSON'));

    var expected = prop_('SHARED_TOKEN');
    if (!expected) return reply_(Utils.fail('NOT_CONFIGURED',
      'SHARED_TOKEN is not set in Script properties'));
    if (String(body.token || '') !== expected) {
      return reply_(Utils.fail('UNAUTHORIZED', 'token mismatch'));
    }

    var fn = Utils.own(ACTIONS, body.action);
    if (typeof fn !== 'function') return reply_(Utils.fail('UNKNOWN_ACTION', String(body.action || '')));

    /* One writer at a time: two phones draining their queues at once would
       otherwise read the same last row and overwrite each other. */
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(25000);
    } catch (err) {
      return reply_(Utils.fail('BUSY', 'another sync is running, try again'));
    }
    try {
      return reply_(fn(body.payload || {}, {
        deviceId: String(body.deviceId || ''), userId: String(body.userId || '')
      }));
    } catch (err) {
      return reply_(Utils.fail('SERVER_ERROR', err && err.message || err));
    } finally {
      lock.releaseLock();
    }
  }

  /* GET exists only so a browser can confirm the deployment is reachable. */
  function handleGet(e) {
    return reply_(Utils.ok({ service: 'BOOTH DESK B2B', version: '3.0',
      configured: !!prop_('SHARED_TOKEN'), ai: !!prop_('ANTHROPIC_API_KEY') }));
  }

  return { handle: handle, handleGet: handleGet };
})();
