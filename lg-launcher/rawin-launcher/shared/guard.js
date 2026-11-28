// What the loopback servers (the helper on 8899, the setup server's panel
// routes on 8898) require of a request. A web page opened in the TV's own
// browser can reach 127.0.0.1 too: with a plain cross-origin GET, or after DNS
// rebinding, where the page's own name resolves to 127.0.0.1. So the Host must
// be the loopback address, and a request that changes something must carry the
// header the panel sets (X-Homebar): a page cannot send it without a preflight
// the servers never answer. Plain ES5: webOS 4 runs this on node 0.12.
'use strict';
function header(req, name) { return String(((req && req.headers) || {})[name] || ''); }
function hostOk(req, port) {
  var h = header(req, 'host').toLowerCase();
  return h === '127.0.0.1:' + port || h === 'localhost:' + port || h === '[::1]:' + port;
}
function marked(req) { return header(req, 'x-homebar') === '1'; }
module.exports = { hostOk: hostOk, marked: marked };
