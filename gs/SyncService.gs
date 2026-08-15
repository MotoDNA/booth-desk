/**
 * Offline queue drain. The device sends queue entries; the server upserts
 * them and returns whatever changed since the device last pulled.
 */
var SyncService = (function () {

  /* The device stores richer objects than the sheet needs. Only mapped
     columns cross over, so a future client field cannot widen the sheet by
     accident. */
  function toRow(entity, p) {
    var common = {
      createdAt: Utils.num(p.createdAt), updatedAt: Utils.num(p.updatedAt),
      deleted: p.deleted ? true : false
    };
    if (entity === 'leads') return Object.assign(common, {
      leadId: p.id, eventId: p.eventId || '', companyId: p.companyId || '',
      fullName: p.fullName || '', jobTitle: p.jobTitle || '',
      email: p.email || '', phone: p.phone || '', country: p.country || '',
      website: p.website || '', leadGrade: p.leadGrade || '',
      leadScore: p.leadScore === null || p.leadScore === undefined ? '' : p.leadScore,
      status: p.status || 'new', assignedTo: p.assignedTo || '',
      interests: Utils.asList(p.interests), requests: Utils.asList(p.requests),
      notes: p.notes || '', nextAction: p.nextAction || '',
      nextActionDate: p.nextActionDate || ''
    });
    if (entity === 'companies') return Object.assign(common, {
      companyId: p.id, companyName: p.companyName || '', website: p.website || '',
      country: p.country || '', industry: p.industry || '',
      businessType: p.businessType || '', products: Utils.asList(p.products),
      markets: Utils.asList(p.markets), employeeSize: p.employeeSize || '',
      description: p.description || '', aiSummary: p.aiSummary || '',
      aiFitScore: p.aiFitScore === null || p.aiFitScore === undefined ? '' : p.aiFitScore,
      aiResearchStatus: p.aiResearchStatus || 'none',
      researchSource: p.researchSource || '', researchedAt: p.researchedAt || ''
    });
    if (entity === 'events') return Object.assign(common, {
      eventId: p.id, eventName: p.eventName || '', startDate: p.startDate || '',
      endDate: p.endDate || '', venue: p.venue || '', country: p.country || '',
      status: p.status || 'active', description: p.description || ''
    });
    if (entity === 'interactions') return Object.assign(common, {
      interactionId: p.id, leadId: p.leadId || '', eventId: p.eventId || '',
      type: p.type || 'note', summary: p.summary || '', notes: p.notes || '',
      interests: Utils.asList(p.interests), requests: Utils.asList(p.requests),
      createdBy: p.createdBy || ''
    });
    if (entity === 'followups') return Object.assign(common, {
      followUpId: p.id, leadId: p.leadId || '', eventId: p.eventId || '',
      type: p.type || '', scheduledAt: Utils.num(p.scheduledAt),
      status: p.status || 'pending', priority: p.priority || 'normal',
      reason: p.reason || '', aiRecommended: p.aiRecommended ? true : false,
      aiReason: p.aiReason || '', subject: p.emailSubject || '',
      body: p.emailBody || '', approvedAt: p.approvedAt || '',
      sentAt: p.sentAt || '', sentBy: p.sentBy || '',
      gmailMessageId: p.gmailMessageId || '', errorMessage: p.errorMessage || ''
    });
    return null;
  }

  function sync(payload, deviceId) {
    var queue = payload.queue || [];
    if (queue.length > CONFIG.MAX_BATCH) return Utils.fail('BATCH_TOO_LARGE',
      'queue of ' + queue.length + ' exceeds ' + CONFIG.MAX_BATCH);

    var grouped = {}, order = [];
    queue.forEach(function (q) {
      var ent = Utils.own(CONFIG.ENTITIES, q.entityType);
      if (!ent) return;
      if (!Utils.isId(String(q.entityId || ''))) return;
      var row = toRow(q.entityType, q.payload || {});
      if (!row) return;
      /* DELETE is a soft delete on the client; carry the flag rather than
         removing the row, so the sheet keeps the audit trail. */
      if (q.action === 'DELETE') row.deleted = true;
      if (!grouped[q.entityType]) { grouped[q.entityType] = []; order.push(q.entityType); }
      grouped[q.entityType].push(row);
    });

    /* Companies and events before leads, leads before what points at them,
       so a sheet read never sees an orphan. */
    var priority = ['events', 'companies', 'leads', 'interactions', 'followups'];
    order.sort(function (a, b) { return priority.indexOf(a) - priority.indexOf(b); });

    var applied = [], stale = [], failed = [];
    order.forEach(function (entity) {
      var ent = Utils.own(CONFIG.ENTITIES, entity);
      try {
        var r = SheetService.upsert(ent.sheet, ent.idCol, grouped[entity]);
        applied = applied.concat(r.applied);
        /* An edit the sheet already has a newer version of is settled, not
           failed. Reported separately so the device stops resending it and
           takes the newer row instead of retrying until it gives up. */
        stale = stale.concat(r.skipped
          .filter(function (x) { return x.why === 'older'; })
          .map(function (x) { return x.id; }));
      } catch (err) {
        failed.push({ entity: entity, message: String(err && err.message || err) });
      }
    });

    logSync_(deviceId, queue, failed);

    var since = Utils.num(payload.since);
    var rows = {};
    Object.keys(CONFIG.ENTITIES).forEach(function (entity) {
      rows[entity] = SheetService.since(CONFIG.ENTITIES[entity].sheet, since);
    });

    return Utils.ok({ applied: applied, stale: stale, failed: failed, rows: rows, now: Date.now() });
  }

  function logSync_(deviceId, queue, failed) {
    try {
      SheetService.append('SyncLogs', {
        syncId: Utilities.getUuid(), deviceId: deviceId || '',
        entityType: 'batch', entityId: '', action: 'SYNC',
        status: failed.length ? 'partial' : 'ok',
        timestamp: new Date().toISOString(),
        errorMessage: failed.length ? JSON.stringify(failed).slice(0, 400) : ''
      });
    } catch (e) { /* logging must never fail the sync itself */ }
  }

  return { sync: sync, toRow: toRow };
})();
