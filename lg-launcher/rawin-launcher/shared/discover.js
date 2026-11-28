// Discover on Homebar: the rows of the Discover-Media plugin on an Emby
// server, for the wallpaper and the poster row of the panel.
//
// The setup server (setup.js) mounts these routes:
//   GET  /discover              (127.0.0.1 only) the current row for the panel
//   GET  /discover/img/<file>   (127.0.0.1 only) a poster or backdrop, cached
//   GET  /discover-config       (token) the settings, the API key masked
//   POST /discover-config       (token) new settings; tested against the server
//   GET  /discover-apps         (token) the TV's apps, to pick the Emby app
//
// The settings are kept in discover.json in the launcher's folder: the
// server's address, an Emby API key, the row (a Discover list) and the app to
// open (an Emby app with the Discover page built in). Images come from TMDB
// and are kept in discover-cache/, so the panel never waits for the internet
// and the wallpaper is there right after a boot. Plain ES5.
'use strict';
var fs = require('fs');
var http = require('http');
var path = require('path');
var crypto = require('crypto');
var urlModule = require('url');

var ROWS = ['trending', 'popular_movie', 'upcoming_movie', 'popular_tv', 'upcoming_tv'];
var TTL = 30 * 60 * 1000;
var RETRY = 2 * 60 * 1000;
var MAX_ITEMS = 20;
var HELPER = 'http://127.0.0.1:8899';

function create(base) {
  var configFile = path.join(base, 'discover.json');
  var cacheDir = path.join(base, 'discover-cache');
  var listFile = path.join(cacheDir, 'list.json');
  var list = readList();
  var refreshing = false, lastTry = 0, lastError = '';

  function readJSON(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }
  function readList() {
    var l = readJSON(listFile);
    return l && Array.isArray(l.items) && Array.isArray(l.rows) ? l : {at: 0, key: '', items: [], rows: []};
  }
  function config() {
    var c = readJSON(configFile) || {};
    return {server: typeof c.server === 'string' ? c.server : '', apiKey: typeof c.apiKey === 'string' ? c.apiKey : '',
      row: ROWS.indexOf(c.row) >= 0 ? c.row : 'trending', appId: typeof c.appId === 'string' ? c.appId : '',
      overTv: c.overTv !== false, saverMinutes: [0, 1, 2, 5, 10, 30].indexOf(c.saverMinutes) >= 0 ? c.saverMinutes : 2};
  }
  function configured(c) { return !!(c.server && c.apiKey); }
  // What the list was made from: a change of server, key or row makes it stale.
  function sourceKey(c) { return crypto.createHash('sha1').update(c.server + '|' + c.apiKey + '|' + c.row).digest('hex').slice(0, 12); }

  function client(url) { return /^https:/i.test(url) ? require('https') : http; }
  function get(url, done, binary) {
    var finished = false;
    function finish(err, value) { if (!finished) { finished = true; done(err, value); } }
    var req;
    try {
      req = client(url).get(url, function (res) {
        var chunks = [], size = 0;
        res.on('data', function (c) { size += c.length; if (size <= 8 * 1024 * 1024) chunks.push(c); });
        res.on('end', function () {
          if (res.statusCode !== 200) return finish(new Error('HTTP ' + res.statusCode));
          if (size > 8 * 1024 * 1024) return finish(new Error('too large'));
          var body = Buffer.concat(chunks);
          if (binary) return finish(null, body);
          try { finish(null, JSON.parse(body.toString('utf8'))); } catch (e) { finish(e); }
        });
      });
    } catch (e) { return finish(e); }
    req.on('error', function (e) { finish(e); });
    req.setTimeout(15000, function () { req.abort(); finish(new Error('timeout')); });
  }
  function api(c, route, query) {
    var q = Object.keys(query || {}).map(function (k) { return k + '=' + encodeURIComponent(query[k]); });
    q.push('api_key=' + encodeURIComponent(c.apiKey));
    return c.server + '/emby/' + route + '?' + q.join('&');
  }

  // A TMDB image as a file in the cache: the name is a hash of its address.
  function imageName(url) { return crypto.createHash('sha1').update(url).digest('hex').slice(0, 20) + '.jpg'; }
  function fetchImage(url, done) {
    if (!url || !/^https:\/\/image\.tmdb\.org\/t\/p\//.test(url)) return done('');
    var name = imageName(url), file = path.join(cacheDir, name);
    if (fs.existsSync(file)) return done(name);
    get(url, function (err, body) {
      if (err || !body || !body.length) return done('');
      try { fs.writeFileSync(file + '.part', body); fs.renameSync(file + '.part', file); } catch (e) { return done(''); }
      done(name);
    }, true);
  }
  function eachInTurn(items, step, done) {
    var i = 0;
    (function next() { if (i >= items.length) return done(); step(items[i++], next); })();
  }

  // Backdrops the panel may ask for, by file name: fetched from TMDB the first
  // time, so only the wallpaper row's backdrops are downloaded ahead.
  var lazy = {}, waiting = {};
  function itemOf(i, poster, backdrop) {
    return {id: i.TmdbId, type: i.Type === 'tv' ? 'tv' : 'movie', title: String(i.Title || ''),
      year: i.Year || 0, rating: typeof i.Rating === 'number' ? Math.round(i.Rating * 10) / 10 : 0,
      status: i.Status || 0, overview: String(i.Overview || '').slice(0, 400), poster: poster, backdrop: backdrop};
  }
  function bigBackdrop(url) { return url ? String(url).replace('/w780/', '/w1280/') : ''; }

  // All rows of the Discover page (/Discover/Home): Recently added, Recent
  // requests, Trending, Popular, Upcoming, as switched on in the plugin, in its
  // order. The row chosen on the phone (or else the first) is the wallpaper's.
  function refresh() {
    var c = config();
    if (!configured(c) || refreshing) return;
    refreshing = true; lastTry = Date.now();
    try { fs.mkdirSync(cacheDir); } catch (e) {}
    get(api(c, 'Discover/Home', {}), function (err, r) {
      if (err || !r || !Array.isArray(r.Rows)) {
        lastError = err ? err.message : (r && r.Message) || 'no rows';
        refreshing = false;
        return;
      }
      var source = r.Rows.filter(function (row) { return row && row.Kind !== 'tiles' && Array.isArray(row.Items) && row.Items.length; })
        .map(function (row) {
          return {key: String(row.Key || ''), title: String(row.Title || row.Key || ''),
            items: row.Items.filter(function (i) { return i && i.TmdbId && i.Poster; }).slice(0, MAX_ITEMS)};
        }).filter(function (row) { return row.items.length; });
      var wallKey = source.some(function (row) { return row.key === c.row; }) ? c.row : (source[0] ? source[0].key : '');
      var nextLazy = {}, rows = [], wall = [];
      eachInTurn(source, function (row, nextRow) {
        var out = {key: row.key, title: row.title, items: []};
        eachInTurn(row.items, function (i, next) {
          fetchImage(i.Poster, function (poster) {
            if (!poster) return next();
            var bdUrl = bigBackdrop(i.Backdrop), bdName = bdUrl ? imageName(bdUrl) : '';
            var item = itemOf(i, poster, bdName);
            out.items.push(item);
            if (row.key !== wallKey || !bdUrl) { if (bdName) nextLazy[bdName] = bdUrl; return next(); }
            // The wallpaper's row: its backdrops ahead, so it never waits.
            fetchImage(bdUrl, function (got) { if (got) wall.push(item); else nextLazy[bdName] = bdUrl; next(); });
          });
        }, function () { if (out.items.length) rows.push(out); nextRow(); });
      }, function () {
        refreshing = false;
        if (!rows.length) { lastError = 'no images'; return; }
        lazy = nextLazy;
        list = {at: Date.now(), key: sourceKey(c), rows: rows, items: wall.length ? wall : rows[0].items, wallKey: wallKey};
        lastError = '';
        try { fs.writeFileSync(listFile + '.part', JSON.stringify(list)); fs.renameSync(listFile + '.part', listFile); } catch (e) {}
        // Images no longer in any row go; backdrops fetched on demand stay
        // while their title is in a row.
        var keep = {};
        rows.forEach(function (row) { row.items.forEach(function (i) { keep[i.backdrop] = true; keep[i.poster] = true; }); });
        try {
          fs.readdirSync(cacheDir).forEach(function (f) {
            if (/\.jpg(\.part)?$/.test(f) && !keep[f]) { try { fs.unlinkSync(path.join(cacheDir, f)); } catch (e) {} }
          });
        } catch (e) {}
      });
    });
  }

  // The panel's answer: what is cached now. A stale list is refreshed in the
  // background and still served meanwhile.
  function current() {
    var c = config();
    if (!configured(c)) return {ok: false, configured: false, items: [], rows: []};
    var fresh = list.key === sourceKey(c);
    var age = Date.now() - list.at;
    if ((!fresh || age > TTL) && Date.now() - lastTry > (list.items.length && fresh ? RETRY : 15000)) refresh();
    return {ok: fresh && list.items.length > 0, configured: true, appId: c.appId, row: c.row, overTv: c.overTv, saverMinutes: c.saverMinutes,
      items: fresh ? list.items : [], rows: fresh ? list.rows : [], wallKey: fresh ? list.wallKey : '', at: list.at, error: lastError};
  }

  function masked(key) { return key ? new Array(Math.min(key.length, 8) - 3).join('•') + key.slice(-4) : ''; }
  function publicConfig(c) { return {server: c.server, apiKey: masked(c.apiKey), hasKey: !!c.apiKey, row: c.row, appId: c.appId, overTv: c.overTv, saverMinutes: c.saverMinutes, rows: ROWS}; }
  function cleanServer(s) {
    s = String(s || '').trim().replace(/\/+$/, '').replace(/\/(emby|web)(\/.*)?$/i, '');
    if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
    return /^https?:\/\/[A-Za-z0-9.\-\[\]:]+$/.test(s) ? s : '';
  }
  // New settings from the phone. The key is kept when none is typed; the
  // server is asked for the plugin before anything is saved.
  function save(body, done) {
    var old = config();
    var c = {server: cleanServer(body.server), apiKey: body.apiKey ? String(body.apiKey).trim() : old.apiKey,
      row: ROWS.indexOf(body.row) >= 0 ? body.row : 'trending', appId: String(body.appId || '').trim(),
      overTv: body.overTv !== false, saverMinutes: [0, 1, 2, 5, 10, 30].indexOf(Number(body.saverMinutes)) >= 0 ? Number(body.saverMinutes) : 2};
    if (!c.server) return done({ok: false, error: 'server'});
    if (!/^[A-Za-z0-9]{16,64}$/.test(c.apiKey)) return done({ok: false, error: 'key'});
    if (c.appId && !/^[A-Za-z0-9._\-]{1,128}$/.test(c.appId)) return done({ok: false, error: 'app'});
    get(api(c, 'Discover/LoaderConfig', {}), function (err, r) {
      if (err) return done({ok: false, error: /HTTP 40[13]/.test(err.message) ? 'key' : 'unreachable', detail: err.message});
      if (!r || !r.Version) return done({ok: false, error: 'plugin'});
      try { fs.writeFileSync(configFile, JSON.stringify(c)); } catch (e) { return done({ok: false, error: 'not saved'}); }
      lastTry = 0;
      refresh();
      done({ok: true, version: r.Version, config: publicConfig(c)});
    });
  }
  // The TV's apps, from the helper, with the likely Emby ones first.
  function apps(done) {
    get(HELPER + '/apps', function (err, r) {
      var all = (!err && r && Array.isArray(r.apps) ? r.apps : []).map(function (a) { return {id: a.id, title: a.title}; });
      function emby(a) { return /emby|discover/i.test(a.id + ' ' + a.title) ? 0 : 1; }
      all.sort(function (a, b) { return emby(a) - emby(b) || String(a.title).localeCompare(String(b.title)); });
      done({ok: !err, apps: all});
    });
  }

  function image(name, res) {
    if (!/^[0-9a-f]{20}\.jpg$/.test(name)) { res.writeHead(404); return res.end(); }
    function serve(again) {
      fs.readFile(path.join(cacheDir, name), function (err, data) {
        if (!err) {
          res.writeHead(200, {'Content-Type': 'image/jpeg', 'Cache-Control': 'max-age=86400'});
          return res.end(data);
        }
        // A backdrop not fetched yet: once, and the asks meanwhile wait for it.
        if (!again && lazy[name]) {
          if (waiting[name]) return waiting[name].push(function () { serve(true); });
          waiting[name] = [function () { serve(true); }];
          return fetchImage(lazy[name], function () {
            var w = waiting[name]; delete waiting[name];
            w.forEach(function (f) { f(); });
          });
        }
        res.writeHead(404); res.end();
      });
    }
    serve(false);
  }

  // Refresh now and then while the TV is on, so the wallpaper is current
  // when HOME is pressed.
  setTimeout(function () { current(); }, 20000);
  setInterval(function () { current(); }, TTL).unref();

  return {current: current, config: function () { return publicConfig(config()); }, save: save, apps: apps, image: image};
}

module.exports = {create: create, ROWS: ROWS};
