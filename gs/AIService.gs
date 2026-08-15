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

  function run(type, payload) {
    if (type === 'lead_analysis') return leadAnalysis(payload || {});
    throw new Error('unsupported analysis type: ' + type);
  }

  return { run: run, json_: json_ };
})();
