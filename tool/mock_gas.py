"""Mock of the deployed Apps Script: same envelope, same sync semantics.
Lets the client's queue drain, retry and pull logic be exercised for real."""
import json, time, threading
from http.server import BaseHTTPRequestHandler, HTTPServer

TOKEN = 'test-token'
STORE = {k: {} for k in ('events','companies','leads','interactions','followups')}
IDCOL = {'events':'eventId','companies':'companyId','leads':'leadId',
         'interactions':'interactionId','followups':'followUpId'}
MODE = {'fail': False, 'drop': set()}
LOG = []

def envelope(ok, data=None, code='', msg=''):
    return {'success': ok, 'data': data, 'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'error': None if ok else {'code': code, 'message': msg}}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _send(self, obj, status=200):
        b = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self): self._send({})

    def do_GET(self):
        if self.path.startswith('/__'):
            return self._send({'store': {k: len(v) for k, v in STORE.items()}, 'log': LOG[-40:]})
        self._send(envelope(True, {'service':'mock','version':'3.0','configured':True,'ai':True}))

    def do_POST(self):
        n = int(self.headers.get('content-length') or 0)
        try: body = json.loads(self.rfile.read(n) or b'{}')
        except Exception: return self._send(envelope(False, code='INVALID_REQUEST', msg='bad json'))

        if body.get('token') != TOKEN:
            return self._send(envelope(False, code='UNAUTHORIZED', msg='token mismatch'))
        action = body.get('action'); p = body.get('payload') or {}
        LOG.append({'action': action, 'n': len(p.get('queue', []))})

        if action == 'ping':
            return self._send(envelope(True, {'pong': True, 'version': '3.0'}))

        if action == 'sync':
            if MODE['fail']:
                return self._send(envelope(False, code='SERVER_ERROR', msg='simulated failure'))
            applied, stale = [], []
            for q in p.get('queue', []):
                ent, eid = q.get('entityType'), str(q.get('entityId') or '')
                if ent not in STORE or not eid: continue
                if eid in MODE['drop']: continue          # simulate a row the server refuses
                pay = dict(q.get('payload') or {})
                cur = STORE[ent].get(eid)
                if cur and float(pay.get('updatedAt') or 0) < float(cur.get('updatedAt') or 0):
                    stale.append(eid); continue
                row = {IDCOL[ent]: eid, 'updatedAt': pay.get('updatedAt') or 0,
                       'createdAt': pay.get('createdAt') or 0,
                       'deleted': True if q.get('action') == 'DELETE' else bool(pay.get('deleted'))}
                for k, v in pay.items():
                    if k in ('id',): continue
                    row[k] = ' / '.join(v) if isinstance(v, list) else v
                # The real SyncService renames the draft columns on the way in;
                # mirror it, or the mock quietly disagrees with the sheet.
                if ent == 'followups':
                    row['subject'] = pay.get('emailSubject') or ''
                    row['body'] = pay.get('emailBody') or ''
                STORE[ent][eid] = row
                applied.append(eid)
            since = float(p.get('since') or 0)
            rows = {e: [r for r in STORE[e].values() if float(r.get('updatedAt') or 0) > since]
                    for e in STORE}
            return self._send(envelope(True, {'applied': applied, 'stale': stale, 'failed': [],
                                              'rows': rows, 'now': int(time.time()*1000)}))

        if action == 'generateLeadAnalysis':
            return self._send(envelope(True, {'leadScore': 88, 'grade': 'A',
                'summary': '샘플과 견적을 함께 요청', 'nextAction': '샘플 발송 후 단가 안내',
                'recommendedDays': 2, 'priority': 'high', 'reason': '명시적 요청',
                'factors': [{'name': 'request specificity', 'points': 20}], 'confidence': 0.9}))

        if action == 'generateEmail':
            who = p.get('recipientName') or '담당자'
            ev = p.get('event') or '전시회'
            sig = p.get('signature') or p.get('senderName') or ''
            body = (who + '님, 안녕하세요.\n\n' + ev + ' 부스에서 나눈 이야기 감사합니다.\n'
                    '요청하신 ' + (p.get('requests') or '자료') + ' 건으로 연락드립니다.\n\n'
                    '필요한 내용을 알려 주시면 준비해 보내드리겠습니다.\n\n' + sig)
            return self._send(envelope(True, {
                'subject': ev + ' 부스 방문 감사합니다 — ' + (p.get('requests') or '후속 안내'),
                'body': body, 'summary': '부스 상담 후속 · 요청 자료 확인',
                'recommendedAction': '요청 자료 준비 후 발송',
                'recommendedFollowupDays': 3,
                'usedFacts': [x for x in ['requests: ' + (p.get('requests') or ''),
                                          'interests: ' + (p.get('interests') or ''),
                                          'notes: ' + (p.get('notes') or '')] if not x.endswith(': ')],
                'confidence': 0.82}))

        if action == '__control':
            MODE['fail'] = bool(p.get('fail'))
            MODE['drop'] = set(p.get('drop') or [])
            return self._send(envelope(True, {'fail': MODE['fail'], 'drop': list(MODE['drop'])}))

        return self._send(envelope(False, code='UNKNOWN_ACTION', msg=str(action)))

HTTPServer(('127.0.0.1', 8793), H).serve_forever()
