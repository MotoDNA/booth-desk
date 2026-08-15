/**
 * Claude proxy.
 *
 * The API key never leaves Script Properties, and the client cannot send a
 * prompt: it names a task and passes fields, and the prompt is built here.
 * That keeps the endpoint from becoming a free Claude relay for anyone who
 * finds the URL, and keeps prompt wording versioned with the server.
 */
var AIService = (function () {

  function call_(system, userText, maxTokens) {
    var key = prop_('ANTHROPIC_API_KEY');
    if (!key) throw new Error('ANTHROPIC_API_KEY is not set in Script properties');

    var res = UrlFetchApp.fetch(CONFIG.AI.endpoint, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: { 'x-api-key': key, 'anthropic-version': CONFIG.AI.apiVersion },
      payload: JSON.stringify({
        model: CONFIG.AI.model,
        max_tokens: maxTokens || CONFIG.AI.maxTokens,
        thinking: CONFIG.AI.thinking,
        system: system,
        messages: [{ role: 'user', content: userText }]
      })
    });

    var code = res.getResponseCode();
    var body = res.getContentText();
    if (code !== 200) throw new Error('Claude ' + code + ' ' + body.slice(0, 200));

    var parsed = JSON.parse(body);
    return (parsed.content || []).map(function (c) { return c.text || ''; }).join('');
  }

  /* Models wrap JSON in prose often enough that the braces are located
     rather than assumed. */
  function json_(text) {
    var t = String(text || '').replace(/```json|```/g, '').trim();
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('no JSON in model reply');
    return JSON.parse(t.slice(a, b + 1));
  }

  var SYSTEM_LEAD =
    'You analyse a trade show booth conversation for a B2B sales team.\n' +
    'Rules you must not break:\n' +
    '- Use only the facts given. Never invent products, prices, promises or company details.\n' +
    '- If the notes do not support a conclusion, say so through a lower confidence.\n' +
    '- recommendedDays must reflect what the visitor actually asked for.\n' +
    'Reply with JSON only, no prose:\n' +
    '{"leadScore":0-100,"grade":"A|B|C","summary":"","nextAction":"",' +
    '"recommendedDays":number,"priority":"high|normal|low","reason":"",' +
    '"factors":[{"name":"","points":0}],"confidence":0-1}';

  /* Scored on the weights in spec 15; the model is told the weights so the
     score and the factor list agree with each other. */
  var WEIGHTS =
    'Weights: interest 30, request specificity 20, purchase intent 20, ' +
    'product fit 15, company fit 10, job position 5. ' +
    'Grade: 80-100 A, 50-79 B, 0-49 C.';

  function leadAnalysis(p) {
    var lines = [
      WEIGHTS, '',
      'Our company: ' + (p.ourCompany || '(not set)'),
      'Our products: ' + (p.ourProducts || '(not set)'),
      '', 'Visitor:',
      '- Company: ' + (p.company || '(unknown)'),
      '- Job title: ' + (p.jobTitle || '(unknown)'),
      '- Interests: ' + (p.interests || '(none recorded)'),
      '- Requests: ' + (p.requests || '(none recorded)'),
      '- Grade given by staff: ' + (p.leadGrade || '(none)'),
      '- Consultation notes: ' + (p.notes || '(none recorded)'),
      '- Event: ' + (p.event || '(unknown)'),
      '', 'Reply language: ' + (p.lang === 'en' ? 'English' : p.lang === 'zh' ? 'Simplified Chinese' : 'Korean')
    ].join('\n');

    var out = json_(call_(SYSTEM_LEAD, lines, 1200));
    out.leadScore = Math.max(0, Math.min(100, Utils.num(out.leadScore)));
    if (['A', 'B', 'C'].indexOf(out.grade) < 0) {
      out.grade = out.leadScore >= 80 ? 'A' : out.leadScore >= 50 ? 'B' : 'C';
    }
    out.recommendedDays = Math.max(1, Math.min(90, Utils.num(out.recommendedDays, 3)));
    if (['high', 'normal', 'low'].indexOf(out.priority) < 0) out.priority = 'normal';
    out.confidence = Math.max(0, Math.min(1, Utils.num(out.confidence, 0.5)));
    return out;
  }

  /* ── Follow-up email draft (spec 31-35) ──────────────────────────────
     Spec 32 is the whole point of this prompt: the draft may only repeat
     what the booth actually recorded. A plausible sentence about a price or
     a lead time that nobody agreed to is worse than no email at all, so the
     rules are stated as prohibitions and the reply carries back the facts
     it claims to have used, for the person approving it to check against. */
  var SYSTEM_EMAIL =
    'You draft one follow-up email for a B2B sales team after a trade show booth conversation.\n' +
    'Hard rules. Breaking any of these makes the draft unusable:\n' +
    '- Use only the facts given below. Never mention a product, price, discount, quantity,\n' +
    '  lead time, specification, certificate or company detail that is not in the input.\n' +
    '- Never refer to anything as discussed unless it appears in the notes, interests,\n' +
    '  requests or history below.\n' +
    '- Never promise, offer or commit to anything the visitor did not ask for. No dates,\n' +
    '  no prices, no quantities, no meetings that are not already in the input.\n' +
    '- If something is missing, leave it out. Never write a placeholder such as [price],\n' +
    '  TBD, XXX or "our representative will confirm the details".\n' +
    '- Plain text only. No HTML, no markdown, no emoji.\n' +
    '- Short: greeting, why we are writing, what was discussed, one clear next step.\n' +
    '- End the body with the signature block exactly as given. If no signature is given,\n' +
    '  end with the sender name alone. Never invent contact details.\n' +
    'usedFacts must quote the input lines the body relies on, so a human can check it.\n' +
    'Reply with JSON only, no prose:\n' +
    '{"subject":"","body":"","summary":"","recommendedAction":"",' +
    '"recommendedFollowupDays":number,"usedFacts":[""],"confidence":0-1}';

  var EMAIL_PURPOSE = {
    thank_you:           'Thank the visitor for stopping by. Nothing is being sent or promised.',
    sample_followup:     'The visitor asked for a sample. Confirm the request and ask for what is needed to send it.',
    quotation_followup:  'The visitor asked for a quotation. Confirm the request and ask for the details needed to prepare it.',
    general_followup:    'The visitor made a request. Confirm it and propose the next step.',
    recontact:           'No request was made. Keep in touch and offer to help, without pushing.'
  };

  function lang_(code) {
    return code === 'en' ? 'English' : code === 'zh' ? 'Simplified Chinese' : 'Korean';
  }

  /* A model asked for plain text still returns the occasional <br> or <p>.
     The draft is shown and stored as text, so markup is removed rather than
     escaped later in three different places. */
  function plain_(v, limit) {
    var s = String(v === null || v === undefined ? '' : v)
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\/\s*p\s*>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\r\n?/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
    return s.trim().slice(0, limit || 8000);
  }

  function historyLines_(list) {
    if (!list || !list.length) return '- (no earlier contact recorded)';
    return list.slice(-8).map(function (h) {
      var bits = [h && h.when, h && h.type, h && h.summary, h && h.notes]
        .filter(function (x) { return x; }).join(' · ');
      return '- ' + String(bits).slice(0, 300);
    }).join('\n');
  }

  function emailDraft(p) {
    var purpose = Utils.own(EMAIL_PURPOSE, String(p.followUpType || '')) ||
                  EMAIL_PURPOSE.general_followup;
    var lines = [
      'Purpose of this email: ' + purpose,
      '', 'Our side:',
      '- Company: ' + (p.ourCompany || '(not set)'),
      '- Products we showed: ' + (p.ourProducts || '(not set)'),
      '- Sender name: ' + (p.senderName || '(not set)'),
      '- Signature block to use verbatim: ' + (p.signature ? '\n' + p.signature : '(none given)'),
      '', 'Recipient:',
      '- Name: ' + (p.recipientName || '(unknown)'),
      '- Job title: ' + (p.jobTitle || '(unknown)'),
      '- Company: ' + (p.company || '(unknown)'),
      '- Country: ' + (p.country || '(unknown)'),
      '', 'Where we met:',
      '- Event: ' + (p.event || '(unknown)'),
      '- Dates: ' + (p.eventDates || '(unknown)'),
      '- Venue: ' + (p.venue || '(unknown)'),
      '', 'What was recorded at the booth:',
      '- Interests: ' + (p.interests || '(none recorded)'),
      '- Requests: ' + (p.requests || '(none recorded)'),
      '- Consultation notes: ' + (p.notes || '(none recorded)'),
      '', 'Earlier contact:',
      historyLines_(p.history),
      '', 'Write the email in: ' + lang_(p.lang)
    ].join('\n');

    var out = json_(call_(SYSTEM_EMAIL, lines, 1800));

    /* One line, because it is a subject; the rest keeps its line breaks. */
    out.subject = plain_(out.subject, 200).replace(/\n+/g, ' ');
    out.body = plain_(out.body, 6000);
    if (!out.subject || !out.body) throw new Error('model returned an empty draft');
    out.summary = plain_(out.summary, 600);
    out.recommendedAction = plain_(out.recommendedAction, 300);
    out.recommendedFollowupDays =
      Math.max(1, Math.min(90, Utils.num(out.recommendedFollowupDays, 7)));
    out.usedFacts = (Array.isArray(out.usedFacts) ? out.usedFacts : [])
      .slice(0, 12).map(function (x) { return plain_(x, 200); })
      .filter(function (x) { return x; });
    out.confidence = Math.max(0, Math.min(1, Utils.num(out.confidence, 0.5)));
    return out;
  }

  function run(type, payload) {
    if (type === 'lead_analysis') return leadAnalysis(payload || {});
    if (type === 'email_draft') return emailDraft(payload || {});
    throw new Error('unsupported analysis type: ' + type);
  }

  return { run: run, json_: json_ };
})();
