define([], function() {
    "use strict";
    var uiLanguage = "nl";

    function text(dutch, english, german, norwegian) {
        return uiLanguage === "de" ? german || english : uiLanguage === "no" ? norwegian || english : uiLanguage === "en" ? english : dutch
    }

    function esc(s) {
        return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    }

    function api(type, path, query, data) {
        var url = ApiClient.getUrl(path, query || {});
        var opts = {
            type: type,
            url: url,
            dataType: "json"
        };
        if (data) {
            opts.data = JSON.stringify(data);
            opts.contentType = "application/json"
        }
        return ApiClient.ajax(opts)
    }
    var diag = {
        load: text("nog niet geprobeerd", "not tried yet", "noch nicht versucht"),
        status: ""
    };
    var diagEl = null;

    function showDiag() {
        if (!diagEl) {
            return
        }
        diagEl.textContent = text("Diagnose: knop-script actief in browser: ", "Diagnostics: request script active in browser: ", "Diagnose: Schaltfl\xe4chenskript im Browser aktiv: ") + (window.__discoverRequestButton ? text("JA v", "YES v", "JA v") + (window.__discoverRequestButtonVersion || text("oud (<0.14.6)", "old (<0.14.6)", "alt (<0.14.6)")) + " build " + (window.__discoverRequestButtonBuild || "?") : text("NEE", "NO", "NEIN")) + "\n" + text("laden vanaf Discover-pagina: ", "loaded from Discover page: ", "von der Discover-Seite geladen: ") + diag.load + "\n" + text("server: ", "server: ", "Server: ") + (diag.status || "...")
    }

    function loadButtonScript() {
        if (window.__discoverRequestButtonVersion === "1.4.0.7") {
            diag.load = text("script is al actief v1.4.0.7", "script already active v1.4.0.7", "Skript bereits aktiv v1.4.0.7");
            showDiag();
            return
        }
        var urls = [ApiClient.getUrl("web/ConfigurationPage", {
            name: "discoverbuttonjs1433"
        }), ApiClient.getUrl("web/configurationpage", {
            name: "discoverbuttonjs1433"
        }), ApiClient.getUrl("Plugins/Discover/Script")];
        var n = 0;
        (function next() {
            if (n >= urls.length) {
                diag.load += text(" (alle adressen mislukt)", " (all addresses failed)", " (alle Adressen fehlgeschlagen)");
                showDiag();
                return
            }
            var u = urls[n++];
            var script = document.createElement("script");
            script.id = "discover-request-button-external";
            script.src = u + (u.indexOf("?") === -1 ? "?" : "&") + "_=" + Date.now();
            script.async = true;
            script.onload = function() {
                if (window.__discoverRequestButtonVersion === "1.4.0.7") {
                    diag.load = text("OK via extern script ", "OK via external script ", "OK \xfcber externes Skript ") + u;
                    showDiag()
                } else {
                    diag.load = text("verouderd script bleef actief (", "outdated script stayed active (", "veraltetes Skript blieb aktiv (") + (window.__discoverRequestButtonVersion || text("geen versienummer", "no version number", "keine Versionsnummer")) + "): " + u;
                    script.parentNode.removeChild(script);
                    next()
                }
            };
            script.onerror = function() {
                diag.load = text("script laden mislukt: ", "loading script failed: ", "Skript laden fehlgeschlagen: ") + u;
                if (script.parentNode) {
                    script.parentNode.removeChild(script)
                }
                next()
            };
            document.head.appendChild(script)
        })()
    }
    var UI_PAGE = "discoverui1150";
    return function(view, params) {
        var embedded = !!(params && params.embedded);
        if (embedded) {
            var lc = String(document.documentElement.lang || "").toLowerCase();
            uiLanguage = lc.indexOf("nl") === 0 ? "nl" : lc.indexOf("de") === 0 ? "de" : lc.indexOf("nb") === 0 || lc.indexOf("nn") === 0 || lc.indexOf("no") === 0 ? "no" : "en"
        }

        function applyAccent(hex) {
            if (window.__dcApplyAccent) {
                window.__dcApplyAccent(hex);
                return
            }
            if (!/^#[0-9a-fA-F]{6}$/.test(hex || "")) {
                return
            }
            var r = parseInt(hex.substr(1, 2), 16),
                g = parseInt(hex.substr(3, 2), 16),
                b = parseInt(hex.substr(5, 2), 16);
            var st = document.documentElement.style;
            st.setProperty("--dc-accent", hex);
            st.setProperty("--dc-accent-rgb", r + "," + g + "," + b);
            st.setProperty("--dc-accent-text", .299 * r + .587 * g + .114 * b > 150 ? "#111" : "#fff");
            try {
                localStorage.setItem("dcAccent", hex)
            } catch (e) {}
        }
        try {
            var savedAccent = localStorage.getItem("dcAccent");
            if (savedAccent) {
                applyAccent(savedAccent)
            }
        } catch (e) {}
        var omdbOn = false;
        var scoreSource = "tmdb";
        diagEl = view.querySelector(".dcDiag");
        diagEl.style.display = "none";
        loadButtonScript();
        api("GET", "Discover/Status").then(function(r) {
            diagEl.style.display = r.ShowDiagnostics ? "" : "none";
            showTrailer = r.ShowTrailerTile !== false;
            showSpecials = r.ShowSpecials !== false;
            applyAccent(r.AccentColor);
            document.documentElement.classList.toggle("dcNoYear", r.PosterShowYear === false);
            document.documentElement.classList.toggle("dcNoScore", r.PosterShowScore === false);
            omdbOn = !!r.OmdbRatings;
            scoreSource = r.PosterScoreSource || (r.PosterShowScore === false ? "none" : "tmdb");
            if (typeof scanPosterScores === "function") {
                scanPosterScores()
            }
            fourK = {
                movie: !!r.Seerr4kMovie,
                tv: !!r.Seerr4kTv
            };
            window.__discoverRequestService = r.RequestService || "";
            radarrSet = !!r.RadarrSet;
            radarrAvail = r.RadarrMinimumAvailability || "released";
            diag.status = "v" + (r.PluginVersion || "?") + " | " + text("pluginresource: ", "plugin resource: ", "Pluginressource: ") + (r.ButtonScript || text("onbekend", "unknown", "unbekannt"));
            showDiag()
        }, function() {
            diag.status = text("status ophalen mislukt", "could not fetch status", "Status konnte nicht abgerufen werden");
            showDiag()
        });
        setTimeout(showDiag, 1500);
        var content = view.querySelector(".dcContent");
        var input = view.querySelector(".dcSearchInput");
        input.placeholder = text("Films en series zoeken", "Search movies and series", "Filme und Serien suchen", "S\xf8k filmer og serier");
        var overlay = view.querySelector(".dcOverlay");
        var toast = view.querySelector(".dcToast");
        var items = {};
        var current = null;
        var searchTimer = null;
        var loaded = false;
        var isAdmin = false;
        var radarrSet = false,
            radarrAvail = "released";
        var showTrailer = true;
        var showSpecials = true;
        var fourK = {
            movie: false,
            tv: false
        };
        try {
            ApiClient.getCurrentUser().then(function(u) {
                isAdmin = !!(u && u.Policy && (u.Policy.IsAdministrator || u.Policy.EnableContentDeletion));
                updateButton()
            }, function() {})
        } catch (e) {}

        function key(i) {
            return i.Type + ":" + i.TmdbId
        }

        function statusIcon(st) {
            return st === 2 ? "&#10003;" : st === 1 ? "&#9203;" : ""
        }
        var queue = {};
        var sabInfo = null;
        var queueTimer = null,
            queueBusy = false,
            pollUntil = 0;
        var QUEUE_POLL = 3e3,
            QUEUE_IDLE = 15e3;

        function stageLabel(stage) {
            return stage === "verifying" ? text("Verifi\xebren", "Verifying", "\xdcberpr\xfcfen", "Verifiserer") : stage === "repairing" ? text("Repareren", "Repairing", "Reparieren", "Reparerer") : stage === "extracting" ? text("Uitpakken", "Extracting", "Entpacken", "Pakker ut") : stage === "moving" ? text("Verplaatsen", "Moving", "Verschieben", "Flytter") : stage === "script" ? text("Script draaien", "Running script", "Skript l\xe4uft", "Kj\xf8rer skript") : text("Wacht op verwerking", "Waiting for processing", "Wartet auf Verarbeitung", "Venter p\xe5 behandling")
        }

        function stateLabel(st, stage) {
            return st === "downloading" ? text("Downloaden", "Downloading", "L\xe4dt herunter", "Laster ned") : st === "paused" ? text("Gepauzeerd", "Paused", "Pausiert", "Pauset") : st === "processing" ? stageLabel(stage) : st === "importwait" ? text("Wacht op import", "Waiting to import", "Wartet auf Import", "Venter p\xe5 import") : st === "importing" ? text("Importeren", "Importing", "Wird importiert", "Importerer") : st === "importblocked" ? text("Import geblokkeerd", "Import blocked", "Import blockiert", "Import blokkert") : st === "stalled" ? text("Probleem", "Problem", "Problem", "Problem") : text("In wachtrij", "Queued", "In Warteschlange", "I k\xf8")
        }

        // Tekst op de balk: "Downloaden 73%"; bij importeren e.d. alleen de status (de balk is dan vol).
        // Voortgang van een nabewerkingsstap uit de regel van SABnzbd: "Unpacking: 2/5" -> "2/5", "Repairing: 41%" -> "41%".
        function stageStep(action) {
            var m = String(action || "").match(/(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?\s*%)/);
            return m ? m[1].replace(/\s+/g, "").replace(/\b0+(\d)/g, "$1") : ""
        }

        function stagePct(action) {
            var s = stageStep(action), m;
            if ((m = s.match(/^(\d+)\/(\d+)$/)) && +m[2] > 0) {
                return Math.max(0, Math.min(100, Math.round(100 * m[1] / m[2])))
            }
            if ((m = s.match(/^(\d+(?:[.,]\d+)?)%$/))) {
                return Math.max(0, Math.min(100, Math.round(parseFloat(m[1].replace(",", ".")))))
            }
            return -1
        }

        function statusText(st, stage, progress, action) {
            if (st === "processing" && stage === "script" && action) {
                return action
            }
            if (st === "processing" && action && stageStep(action)) {
                return stateLabel(st, stage) + " " + stageStep(action)
            }
            return stateLabel(st, stage) + ((st === "downloading" || st === "paused" || st === "stalled") && progress > 0 ? " " + progress + "%" : "")
        }

        function fullBar(st) {
            return st === "processing" || st === "importwait" || st === "importing" || st === "importblocked"
        }

        function decimal(v) {
            return String(v).replace(".", text(",", ".", ",", ","))
        }

        function rateText(bps) {
            if (!(bps > 0)) {
                return ""
            }
            var u = ["KB/s", "MB/s", "GB/s"],
                i = 0,
                v = bps / 1024;
            while (v >= 1024 && i < 2) {
                v /= 1024;
                i++
            }
            return decimal(v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + " " + u[i]
        }

        function sizeText(p) {
            var total = p.Size;
            if (!(total > 0)) {
                return ""
            }
            var u = ["B", "KB", "MB", "GB", "TB"],
                i = 0,
                t = total;
            while (t >= 1024 && i < 4) {
                t /= 1024;
                i++
            }
            var div = Math.pow(1024, i);

            function f(x) {
                var v = x / div;
                return decimal(v >= 100 || i === 0 ? Math.round(v) : Math.round(v * 10) / 10)
            }
            var done = total - (p.SizeLeft || 0);
            var partial = (p.State === "downloading" || p.State === "paused" || p.State === "queued" || p.State === "stalled") && p.SizeLeft > 0 && done > 0;
            return partial ? f(done) + text(" van ", " of ", " von ", " av ") + f(total) + " " + u[i] : f(total) + " " + u[i]
        }

        function timeLeft(sec) {
            if (typeof sec !== "number" || sec < 0) {
                return ""
            }
            if (sec < 60) {
                return "<1 min"
            }
            var h = Math.floor(sec / 3600),
                m = Math.round(sec % 3600 / 60);
            if (m === 60) {
                h++;
                m = 0
            }
            if (h >= 24) {
                var d = Math.floor(h / 24);
                h = h % 24;
                return d + "d" + (h ? " " + h + text("u", "h", "h", "t") : "")
            }
            return h > 0 ? h + text("u ", "h ", "h ", "t ") + m + "m" : m + " min"
        }

        // Serie met meer afleveringen in de wachtrij: toon alleen de aflevering die nu aan de beurt is.
        var PART_ORDER = ["downloading", "processing", "importing", "importwait", "importblocked", "stalled", "paused", "queued"];

        function curPart(e) {
            if (!e || e.Type !== "tv" || !e.Parts || e.Parts.length < 2) {
                return null
            }
            for (var o = 0; o < PART_ORDER.length; o++) {
                for (var k = 0; k < e.Parts.length; k++) {
                    if (e.Parts[k].State === PART_ORDER[o]) {
                        return e.Parts[k]
                    }
                }
            }
            return e.Parts[0]
        }

        function queueLine(e) {
            var cp = curPart(e);
            var src = cp || e;
            var parts = [];
            if (cp && cp.Label) {
                parts.push(cp.Label)
            }
            parts.push(statusText(src.State, src.Stage, src.Progress, src.Action));
            if (src.State === "downloading") {
                var t = timeLeft(src.TimeLeft);
                if (t) {
                    parts.push(t)
                }
                var sp = rateText(src.Speed);
                if (sp) {
                    parts.push(sp)
                }
            }
            return parts.join(" \xb7 ")
        }

        function queueHtml(i) {
            var e = queue[key(i)];
            if (!e) {
                return ""
            }
            var src = curPart(e) || e;
            return '<div class="dcProg ' + esc(src.State) + '"><i style="width:' + (fullBar(src.State) ? 100 : src.Progress) + '%"></i></div>'
        }

        function capQueueHtml(i, mine) {
            var e = queue[key(i)];
            if (e) {
                var src = curPart(e) || e;
                return '<div class="dcCapQ ' + esc(src.State) + '" style="--p:' + (fullBar(src.State) ? 100 : src.Progress || 0) + '%">' + esc(queueLine(e)) + "</div>"
            }
            if (!mine) {
                return ""
            }
            return i.Status === 2 ? '<div class="dcCapQ avail">✓ ' + text("Beschikbaar", "Available", "Verf\xfcgbar", "Tilgjengelig") + "</div>" : '<div class="dcCapQ req">' + text("Aangevraagd", "Requested", "Angefordert", "Forespurt") + "</div>"
        }

        function applyQueueToCards() {
            var cards = view.querySelectorAll(".dcCard[data-key]");
            for (var c = 0; c < cards.length; c++) {
                var card = cards[c],
                    i = items[card.getAttribute("data-key")];
                if (!i) {
                    continue
                }
                var poster = card.querySelector(".dcPoster"),
                    cap = card.querySelector(".dcCap");
                var oldP = poster && poster.querySelector(".dcProg");
                if (oldP) {
                    poster.removeChild(oldP)
                }
                var oldQ = cap && cap.querySelector(".dcCapQ");
                if (oldQ) {
                    cap.removeChild(oldQ)
                }
                if (poster) {
                    poster.insertAdjacentHTML("beforeend", queueHtml(i))
                }
                if (cap) {
                    cap.insertAdjacentHTML("beforeend", capQueueHtml(i, card.hasAttribute("data-mine")))
                }
            }
        }

        function pageActive() {
            if (embedded) {
                return document.body.contains(view) && overlay.classList.contains("open")
            }
            return onDiscoverRoute() && document.body.contains(view)
        }

        function scheduleQueue(ms) {
            clearTimeout(queueTimer);
            queueTimer = setTimeout(loadQueue, ms)
        }

        function loadQueue() {
            queueTimer = null;
            if (queueBusy || !pageActive()) {
                return
            }
            if (document.hidden) {
                scheduleQueue(QUEUE_IDLE);
                return
            }
            queueBusy = true;
            api("GET", "Discover/Queue").then(function(r) {
                queueBusy = false;
                var next = {},
                    gone = false;
                sabInfo = r && r.Sab || null;
                (r && r.Items || []).forEach(function(e) {
                    next[e.Type + ":" + e.TmdbId] = e
                });
                for (var k in queue) {
                    if (queue.hasOwnProperty(k) && !next[k]) {
                        gone = true
                    }
                }
                queue = next;
                applyQueueToCards();
                if (current) {
                    renderQueueInfo(current);
                    if (!delArmed) {
                        updateButton()
                    }
                }
                if (gone) {
                    loadMyRequests()
                }
                // Snel verversen zolang er iets downloadt of de popup open staat; anders rustig blijven kijken,
                // zodat een download die elders is gestart vanzelf verschijnt.
                scheduleQueue(Object.keys(queue).length || overlay.classList.contains("open") || Date.now() < pollUntil ? QUEUE_POLL : QUEUE_IDLE)
            }, function() {
                queueBusy = false;
                scheduleQueue(QUEUE_POLL * 3)
            })
        }

        function afterRequest() {
            pollUntil = Date.now() + 5 * 60 * 1e3;
            scheduleQueue(5e3);
            loadMyRequests()
        }

        // Algemene toestand van SABnzbd, alleen als deze download via SABnzbd loopt.
        function sabLine(e) {
            if (!sabInfo) {
                return ""
            }
            var viaSab = false;
            for (var k = 0; k < e.Parts.length; k++) {
                if (e.Parts[k].Via && e.Parts[k].Via === sabInfo.Name) {
                    viaSab = true
                }
            }
            if (!viaSab) {
                return ""
            }
            var out = [sabInfo.Name || "SABnzbd"];
            if (sabInfo.Paused) {
                out.push(text("gepauzeerd", "paused", "pausiert", "pauset"))
            } else if (sabInfo.Speed > 0) {
                out.push(rateText(sabInfo.Speed))
            }
            if (sabInfo.LimitBps > 0) {
                out.push(text("limiet ", "limit ", "Limit ", "grense ") + rateText(sabInfo.LimitBps))
            } else if (sabInfo.LimitPct > 0) {
                out.push(text("limiet ", "limit ", "Limit ", "grense ") + sabInfo.LimitPct + "%")
            }
            return out.length > 1 ? out.join(" \xb7 ") : ""
        }

        function renderQueueInfo(i) {
            var box = overlay.querySelector(".dcQueue");
            if (!box) {
                return
            }
            var e = queue[key(i)];
            if (!e) {
                box.classList.remove("show");
                box.innerHTML = "";
                return
            }
            var max = isTvClient ? 3 : 8;
            var shown = e.Parts;
            if (e.Type === "tv" && e.Parts.length > 1) {
                var dl = e.Parts.filter(function(p) {
                    return p.State === "downloading"
                });
                shown = dl.length ? dl : [curPart(e)]
            }
            var html = '<div class="dcQHead">' + esc(stateLabel(e.State, e.Stage)) + (e.Count > 1 ? " \xb7 " + e.Count + " " + text("downloads", "downloads", "Downloads", "nedlastinger") : "") + "</div>";
            var sab = sabLine(e);
            if (sab) {
                html += '<div class="dcQSab">' + esc(sab) + "</div>"
            }
            shown.slice(0, max).forEach(function(p) {
                var name = p.Label ? p.Label + (p.Name ? " \xb7 " + p.Name : "") : i.Title;
                var right = statusText(p.State, p.Stage, p.Progress, p.Action);
                if (p.State === "downloading") {
                    var tl = timeLeft(p.TimeLeft),
                        sp = rateText(p.Speed);
                    right += (tl ? " \xb7 " + tl : "") + (sp ? " \xb7 " + sp : "")
                }
                html += '<div class="dcQRow"' + (p.Release ? ' title="' + esc(p.Release) + '"' : "") + '><span class="dcQName">' + esc(name) + "</span>" + '<span class="dcQBar ' + esc(p.State) + '"><i style="width:' + (p.State === "processing" && stagePct(p.Action) >= 0 ? stagePct(p.Action) : fullBar(p.State) ? 100 : p.Progress) + '%"></i></span>' + '<span class="dcQPct ' + esc(p.State) + '">' + esc(right) + "</span></div>";
                if (p.Release) {
                    html += '<div class="dcQRel">' + esc(p.Release) + "</div>"
                }
                var meta = [];
                var sz = sizeText(p);
                if (sz) {
                    meta.push(sz)
                }
                if (p.State === "downloading" && p.Seeds >= 0) {
                    meta.push(p.Seeds + " seeders")
                }
                if (p.Ratio > 0) {
                    meta.push("ratio " + decimal(Math.round(p.Ratio * 100) / 100))
                }
                if (p.Client) {
                    meta.push(p.Client)
                }
                if (p.Indexer) {
                    meta.push(p.Indexer)
                }
                if (meta.length) {
                    html += '<div class="dcQMeta">' + esc(meta.join(" \xb7 ")) + "</div>"
                }
                if (p.Reason && (p.State === "importblocked" || p.State === "stalled")) {
                    html += '<div class="dcQWhy">' + esc(p.Reason) + "</div>"
                }
            });
            if (e.Parts.length > Math.min(max, shown.length)) {
                html += '<div class="dcQMore">' + text("en nog ", "and ", "und ", "og ") + (e.Parts.length - Math.min(max, shown.length)) + text(" meer", " more", " weitere", " til") + "</div>"
            }
            box.innerHTML = html;
            box.classList.add("show")
        }
        var mineRow = null,
            homeShown = false;

        function loadMyRequests() {
            api("GET", "Discover/MyRequests").then(function(r) {
                mineRow = r || null;
                renderMine()
            }, function() {})
        }

        function renderMine() {
            var top = content.querySelector(".dcTop");
            if (!homeShown || !top) {
                return
            }
            var old = top.querySelector(".dcMine");
            var list = mineRow && mineRow.Items || [];
            if (!list.length) {
                if (old) {
                    old.parentNode.removeChild(old)
                }
                return
            }
            var scroll = old ? old.querySelector(".dcRow").scrollLeft : 0;
            var html = '<div class="dcMine"><div class="dcRowTitle">' + esc(text("Mijn aanvragen", "My requests", "Meine Anfragen", "Mine foresp\xf8rsler")) + "</div>" + rowWrapHtml('<div class="dcRow" data-row="my_requests">' + list.map(function(i) {
                return cardHtml(i, true, null, list.length <= WIDE_MAX)
            }).join("") + "</div>") + "</div>";
            var hadFocus = old && old.contains(document.activeElement) ? document.activeElement.getAttribute("data-key") : null;
            if (old) {
                old.insertAdjacentHTML("afterend", html);
                old.parentNode.removeChild(old)
            } else {
                top.insertAdjacentHTML("afterbegin", html)
            }
            var box = top.querySelector(".dcMine");
            var row = box.querySelector(".dcRow");
            row.scrollLeft = scroll;
            if (hadFocus) {
                var f = row.querySelector('.dcCard[data-key="' + hadFocus + '"]');
                if (f) {
                    focusEl(f)
                }
            }
            updateArrows(box.querySelector(".dcRowWrap"))
        }
        var extraRows = {
            cont: null,
            watch: []
        };

        function loadExtras() {
            api("GET", "Discover/ContinueSeries").then(function(r) {
                extraRows.cont = r || null;
                renderExtras()
            }, function() {});
            api("GET", "Discover/Watchlist").then(function(r) {
                extraRows.watch = r && r.Rows || [];
                renderExtras()
            }, function() {})
        }

        function extraTitle(r) {
            if (r.Key === "continue_series") {
                return text("Nieuwe seizoenen", "New seasons", "Neue Staffeln", "Nye sesonger")
            }
            if (r.Key === "watch_trakt") {
                return text("Trakt-watchlist", "Trakt watchlist", "Trakt-Merkliste", "Trakt-\xf8nskeliste")
            }
            return r.Title
        }

        function renderExtras() {
            var top = content.querySelector(".dcTop");
            if (!homeShown || !top) {
                return
            }
            var olds = top.querySelectorAll(".dcExtra");
            var rows = [];
            if (extraRows.cont && extraRows.cont.Items && extraRows.cont.Items.length) {
                rows.push(extraRows.cont)
            }
            extraRows.watch.forEach(function(r) {
                if (r.Items && r.Items.length) {
                    rows.push(r)
                }
            });
            var scrolls = {};
            Array.prototype.forEach.call(olds, function(o) {
                Array.prototype.forEach.call(o.querySelectorAll(".dcRow"), function(rw) {
                    scrolls[rw.getAttribute("data-row")] = rw.scrollLeft
                });
                o.parentNode.removeChild(o)
            });
            if (!rows.length) {
                return
            }
            var html = "";
            rows.forEach(function(r) {
                var open = r.Items.filter(function(i) {
                    return i.Status === 0
                }).length;
                var all = r.Key.indexOf("watch_") === 0 && open > 0 ? ' <button type="button" class="dcReqAll focusable" data-row="' + esc(r.Key) + '">' + esc(text("Alles aanvragen", "Request all", "Alle anfragen", "Be om alle")) + " (" + open + ")</button>" : "";
                html += '<div class="dcExtra"><div class="dcRowTitle">' + esc(extraTitle(r)) + all + "</div>" + rowWrapHtml('<div class="dcRow" data-row="' + esc(r.Key) + '">' + r.Items.map(function(i) {
                    return cardHtml(i, false, null, r.Items.length <= WIDE_MAX)
                }).join("") + "</div>") + "</div>"
            });
            top.insertAdjacentHTML("beforeend", html);
            Array.prototype.forEach.call(top.querySelectorAll(".dcExtra .dcRow"), function(rw) {
                rw.scrollLeft = scrolls[rw.getAttribute("data-row")] || 0;
                updateArrows(rw.parentNode)
            })
        }

        function requestAll(rowKey, btn) {
            var row = null;
            extraRows.watch.forEach(function(r) {
                if (r.Key === rowKey) {
                    row = r
                }
            });
            if (!row) {
                return
            }
            var todo = row.Items.filter(function(i) {
                return i.Status === 0
            });
            if (!todo.length) {
                return
            }
            if (!window.confirm(text(todo.length + " titels aanvragen?", "Request " + todo.length + " titles?", todo.length + " Titel anfragen?", "Be om " + todo.length + " titler?"))) {
                return
            }
            btn.disabled = true;
            var ok = 0,
                fail = 0,
                lastErr = "";
            (function next(n) {
                if (n >= todo.length) {
                    showToast(text(ok + " aangevraagd", ok + " requested", ok + " angefragt", ok + " forespurt") + (fail ? " \xb7 " + text(fail + " mislukt: ", fail + " failed: ", fail + " fehlgeschlagen: ", fail + " mislyktes: ") + lastErr : ""), fail > 0);
                    afterRequest();
                    renderExtras();
                    return
                }
                var i = todo[n];
                btn.textContent = text("Aanvragen... ", "Requesting... ", "Wird angefragt... ", "Ber om... ") + (n + 1) + "/" + todo.length;
                api("POST", "Discover/RequestItem", null, {
                    Type: i.Type,
                    TmdbId: i.TmdbId
                }).then(function(r) {
                    if (r && r.Success) {
                        ok++;
                        i.Status = 1;
                        refreshCards(i)
                    } else {
                        fail++;
                        lastErr = r && r.Message || "?";
                        if (r && /limiet|limit|toegang|access|Zugriff/i.test(lastErr)) {
                            fail += todo.length - n - 1;
                            n = todo.length
                        }
                    }
                    next(n + 1)
                }, function() {
                    fail++;
                    lastErr = text("netwerkfout", "network error", "Netzwerkfehler", "nettverksfeil");
                    next(n + 1)
                })
            })(0)
        }
        var CHEV_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 1 0 1.4L10.4 12l4.3 4.3a1 1 0 0 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0z"/></svg>';
        var CHEV_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.3 6.3a1 1 0 0 0 0 1.4l4.3 4.3-4.3 4.3a1 1 0 1 0 1.4 1.4l5-5a1 1 0 0 0 0-1.4l-5-5a1 1 0 0 0-1.4 0z"/></svg>';

        function rowTitle(k) {
            switch (k) {
                case "recent_added":
                    return text("Onlangs toegevoegd", "Recently added", "K\xfcrzlich hinzugef\xfcgt", "Nylig lagt til");
                case "recent_requests":
                    return text("Recente aanvragen", "Recent requests", "K\xfcrzlich angefragt", "Nylige foresp\xf8rsler");
                case "trending":
                    return "Trending";
                case "popular_movie":
                    return text("Populaire films", "Popular Movies", "Beliebte Filme", "Popul\xe6re filmer");
                case "genres_movie":
                    return text("Filmgenres", "Movie Genres", "Filmgenres", "Filmsjangre");
                case "upcoming_movie":
                    return text("Aankomende films", "Upcoming Movies", "Kommende Filme", "Kommende filmer");
                case "studios":
                    return text("Studio's", "Studios", "Studios", "Studioer");
                case "popular_tv":
                    return text("Populaire series", "Popular Series", "Beliebte Serien", "Popul\xe6re serier");
                case "genres_tv":
                    return text("Seriegenres", "Series Genres", "Seriengenres", "Seriesjangre");
                case "upcoming_tv":
                    return text("Aankomende series", "Upcoming Series", "Kommende Serien", "Kommende serier");
                case "networks":
                    return text("Netwerken", "Networks", "Sender", "Nettverk");
                case "my_requests":
                    return text("Mijn aanvragen", "My requests", "Meine Anfragen", "Mine foresp\xf8rsler")
            }
            return null
        }

        function rowWrapHtml(inner) {
            return '<div class="dcRowWrap">' + '<button type="button" class="dcArrow left dcHide" data-dir="-1" tabindex="-1" aria-label="' + esc(text("Vorige", "Previous", "Zur\xfcck", "Forrige")) + '">' + CHEV_L + "</button>" + inner + '<button type="button" class="dcArrow right" data-dir="1" tabindex="-1" aria-label="' + esc(text("Volgende", "Next", "Weiter", "Neste")) + '">' + CHEV_R + "</button>" + "</div>"
        }
        content.addEventListener("mouseenter", function(e) {
            var w = e.target && e.target.classList && e.target.classList.contains("dcRowWrap") ? e.target : null;
            if (w) {
                updateArrows(w)
            }
        }, true);

        function updateArrows(wrap) {
            if (!wrap) {
                return
            }
            var row = wrap.querySelector(".dcRow");
            var l = wrap.querySelector(".dcArrow.left"),
                r = wrap.querySelector(".dcArrow.right");
            if (!row || !l || !r) {
                return
            }
            var max = row.scrollWidth - row.clientWidth;
            l.classList.toggle("dcHide", row.scrollLeft <= 12);
            r.classList.toggle("dcHide", row.scrollLeft >= max - 12)
        }

        function updateAllArrows() {
            var wraps = content.querySelectorAll(".dcRowWrap");
            for (var w = 0; w < wraps.length; w++) {
                updateArrows(wraps[w])
            }
        }
        var WIDE_MAX = 3;

        function cardHtml(i, mine, embyId, wide) {
            items[key(i)] = i;
            var poster = i.Poster ? '<img loading="lazy" src="' + esc(i.Poster) + '" alt="" />' : '<div class="dcNoPoster">' + esc(i.Title) + "</div>";
            var sub = [];
            if (typeof i.Rating === "number" && i.Rating > 0) {
                sub.push('<span class="dcStar"' + (i.TmdbId ? "" : "") + ">&#9733; " + i.Rating.toFixed(1) + "</span>")
            }
            if (i.Year) {
                sub.push('<span class="dcYear">' + i.Year + "</span>")
            }
            var role = i.Role ? i.Role === "Director" ? text("Regie", "Director", "Regie", "Regi") : i.Role : "";
            var bgUrl = wide ? i.Backdrop || i.Poster || "" : "";
            return '<div class="dcCard focusable' + (wide ? " dcWide" : "") + '" tabindex="0" role="button" data-key="' + key(i) + '"' + (mine === true ? ' data-mine="1"' : "") + (embyId ? ' data-emby="' + esc(embyId) + '"' : "") + ">" + (wide ? '<div class="dcWideBg' + (i.Backdrop ? "" : " blur") + '"' + (bgUrl ? ' style="background-image:url(&quot;' + esc(bgUrl) + '&quot;)"' : "") + '></div><div class="dcWideShade"></div>' : "") + '<div class="dcPoster">' + poster + (wide ? "" : '<span class="dcBadge ' + i.Type + '">' + (i.Type === "tv" ? text("SERIE", "SERIES", "SERIE") : text("FILM", "MOVIE", "FILM")) + "</span>") + '<span class="dcStatus s' + i.Status + '">' + statusIcon(i.Status) + "</span>" + queueHtml(i) + "</div>" + '<div class="dcCap">' + (wide ? '<span class="dcBadge ' + i.Type + '">' + (i.Type === "tv" ? text("SERIE", "SERIES", "SERIE") : text("FILM", "MOVIE", "FILM")) + "</span>" : "") + '<div class="dcCapT">' + esc(i.Title) + "</div>" + (sub.length ? '<div class="dcCapSub">' + sub.join("") + "</div>" : "") + (role ? '<div class="dcRole" title="' + esc(role) + '">' + esc(role) + "</div>" : "") + capQueueHtml(i, mine === true) + "</div></div>"
        }
        var imdbCache = {},
            imdbQueue = [],
            imdbBusy = 0,
            scoreObs = null;

        function fetchImdb(i, cb) {
            var k = i.Type + ":" + i.TmdbId;
            var c = imdbCache[k];
            if (c && c.done) {
                cb(c.r);
                return
            }
            if (c) {
                c.cbs.push(cb);
                return
            }
            c = imdbCache[k] = {
                done: false,
                r: null,
                cbs: [cb]
            };
            imdbQueue.push({
                i: i,
                c: c
            });
            pumpImdb()
        }

        function pumpImdb() {
            while (imdbBusy < 3 && imdbQueue.length) {
                (function(job) {
                    imdbBusy++;

                    function finish(r) {
                        imdbBusy--;
                        job.c.done = true;
                        job.c.r = r;
                        var l = job.c.cbs;
                        job.c.cbs = [];
                        for (var x = 0; x < l.length; x++) {
                            l[x](r)
                        }
                        pumpImdb()
                    }
                    api("GET", "Discover/ImdbScore", {
                        Type: job.i.Type,
                        TmdbId: job.i.TmdbId
                    }).then(finish, function() {
                        finish(null)
                    })
                })(imdbQueue.shift())
            }
        }

        function fillImdbScore(card) {
            var i = items[card.getAttribute("data-key")];
            if (!i || !i.TmdbId) {
                return
            }
            fetchImdb(i, function(r) {
                if (!r || !r.Imdb) {
                    return
                }
                var slot = card.querySelector(".dcCapSub .dcStar");
                if (!slot) {
                    var sub = card.querySelector(".dcCapSub");
                    if (!sub) {
                        return
                    }
                    slot = document.createElement("span");
                    slot.className = "dcStar";
                    sub.insertBefore(slot, sub.firstChild)
                }
                slot.className = "dcStar dcImdb";
                slot.innerHTML = "<b>IMDb</b> " + esc(r.Imdb);
                slot.title = "IMDb" + (r.Votes ? " \xb7 " + r.Votes : "")
            })
        }

        function scanPosterScores() {
            if (scoreSource !== "imdb") {
                return
            }
            var cards = content.querySelectorAll(".dcCard:not([data-sc])");
            for (var x = 0; x < cards.length; x++) {
                var card = cards[x];
                card.setAttribute("data-sc", "1");
                if (typeof IntersectionObserver === "undefined") {
                    fillImdbScore(card);
                    continue
                }
                if (!scoreObs) {
                    scoreObs = new IntersectionObserver(function(es) {
                        es.forEach(function(e) {
                            if (e.isIntersecting) {
                                scoreObs.unobserve(e.target);
                                fillImdbScore(e.target)
                            }
                        })
                    }, {
                        rootMargin: "200px"
                    })
                }
                scoreObs.observe(card)
            }
        }
        if (typeof MutationObserver !== "undefined") {
            new MutationObserver(function() {
                scanPosterScores()
            }).observe(content, {
                childList: true,
                subtree: true
            })
        }

        function skelCards(n) {
            var cards = "";
            for (var c = 0; c < (n || 8); c++) {
                cards += '<div class="dcSkel"><div class="dcSkelP"></div><div class="dcSkelT"></div></div>'
            }
            return cards
        }

        function skeletonHtml(rows) {
            var out = "";
            for (var r = 0; r < (rows || 3); r++) {
                out += '<div class="dcRowTitle" style="opacity:.35">\xa0</div><div class="dcSkelRow">' + skelCards(8) + "</div>"
            }
            return out
        }

        function logoStats(img) {
            var nw = img.naturalWidth || 1,
                nh = img.naturalHeight || 1;
            var w = 128,
                h = Math.max(1, Math.round(128 * nh / nw));
            if (h > 128) {
                h = 128;
                w = Math.max(1, Math.round(128 * nw / nh))
            }
            var c = document.createElement("canvas");
            c.width = w;
            c.height = h;
            var g = c.getContext("2d");
            g.drawImage(img, 0, 0, w, h);
            var d = g.getImageData(0, 0, w, h).data;
            var minX = w,
                minY = h,
                maxX = -1,
                maxY = -1,
                opaque = 0,
                dark = 0,
                light = 0,
                lumSum = 0,
                colorful = 0,
                distSum = 0;
            for (var y = 0; y < h; y++) {
                for (var x = 0; x < w; x++) {
                    var i = (y * w + x) * 4;
                    if (d[i + 3] < 128) {
                        continue
                    }
                    opaque++;
                    if (x < minX) {
                        minX = x
                    }
                    if (x > maxX) {
                        maxX = x
                    }
                    if (y < minY) {
                        minY = y
                    }
                    if (y > maxY) {
                        maxY = y
                    }
                    var lum = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2];
                    var mx = Math.max(d[i], d[i + 1], d[i + 2]),
                        mn = Math.min(d[i], d[i + 1], d[i + 2]);
                    lumSum += lum;
                    if (mx && (mx - mn) / mx > .35 && lum >= 60) {
                        colorful++
                    }
                    if (lum < 90) {
                        dark++
                    } else if (lum > 170) {
                        light++
                    }
                    distSum += Math.sqrt((d[i] - 28) * (d[i] - 28) + (d[i + 1] - 38) * (d[i + 1] - 38) + (d[i + 2] - 64) * (d[i + 2] - 64))
                }
            }
            if (!opaque) {
                return null
            }
            return {
                fill: opaque / ((maxX - minX + 1) * (maxY - minY + 1)),
                dark: dark / opaque,
                light: light / opaque,
                lum: lumSum / opaque,
                colorful: colorful / opaque,
                dist: distSum / opaque
            }
        }

        function logoScore(st) {
            if (!st) {
                return 0
            }
            var lightVersion = st.lum >= 120 && st.dark < .35;
            if (lightVersion && st.colorful >= .02) {
                return 4
            }
            if (st.colorful > .55 && st.lum >= 85 && st.dist >= 150) {
                return 3
            }
            if (lightVersion) {
                return 2
            }
            if (st.fill > .6 && Math.min(st.dark, st.light) > .03) {
                return 1
            }
            return 0
        }

        function probeLogo(url) {
            return new Promise(function(resolve) {
                var probe = new Image;
                probe.crossOrigin = "anonymous";
                probe.onload = function() {
                    var st = null;
                    try {
                        st = logoStats(probe)
                    } catch (e) {
                        st = null
                    }
                    resolve(st)
                };
                probe.onerror = function() {
                    resolve(null)
                };
                probe.src = url + (url.indexOf("?") === -1 ? "?" : "&") + "dcprobe=1"
            })
        }
        var logoChoice = {};

        function applyLogoChoice(key, ch) {
            Array.prototype.forEach.call(view.querySelectorAll("img.dcTileLogo"), function(im) {
                if (im.getAttribute("data-logo0") !== key) {
                    return
                }
                if (ch.src && im.getAttribute("src") !== ch.src) {
                    im.setAttribute("src", ch.src)
                }
                im.classList.toggle("dcOrig", !!ch.orig)
            })
        }

        function checkLogo(img) {
            var key = img.getAttribute("data-logo0") || img.getAttribute("src");
            if (!key) {
                return
            }
            if (!img.getAttribute("data-logo0")) {
                img.setAttribute("data-logo0", key)
            }
            var known = logoChoice[key];
            if (known && known !== "busy") {
                applyLogoChoice(key, known);
                return
            }
            if (known === "busy") {
                return
            }
            logoChoice[key] = "busy";
            var alts = (img.getAttribute("data-alts") || "").split("|").filter(function(u) {
                return u
            });
            var urls = [key].concat(alts);
            Promise.all(urls.map(probeLogo)).then(function(stats) {
                var best = -1,
                    bestScore = 0;
                for (var k = 0; k < stats.length; k++) {
                    var sc = logoScore(stats[k]);
                    if (sc > bestScore) {
                        best = k;
                        bestScore = sc
                    }
                }
                var ch = best >= 0 ? {
                    src: urls[best],
                    orig: true
                } : {
                    src: key,
                    orig: false
                };
                logoChoice[key] = ch;
                applyLogoChoice(key, ch)
            })
        }
        content.addEventListener("load", function(e) {
            var t = e.target;
            if (t && t.classList && t.classList.contains("dcTileLogo")) {
                checkLogo(t)
            }
        }, true);

        function tileHtml(r, t) {
            var inner = t.Image ? '<img class="dcTileLogo" loading="lazy" src="' + esc(t.Image) + '" data-logo0="' + esc(t.Image) + '"' + (t.Images && t.Images.length ? ' data-alts="' + esc(t.Images.join("|")) + '"' : "") + ' alt="' + esc(t.Name) + '" />' : "<span>" + esc(t.Name) + "</span>";
            var bg = t.Backdrop ? "background:" + esc(t.Color || "#1c2640") + " url(&quot;" + esc(t.Backdrop) + "&quot;) center/cover no-repeat" : "background:" + esc(t.Color || "#1c2640");
            return '<div class="dcTile focusable' + (t.Image ? " logo" : "") + (t.Backdrop ? " photo" : "") + '" tabindex="0" role="button" data-kind="' + esc(r.TileKind) + '" data-id="' + esc(t.Id) + (t.Backdrop ? '" data-bd="' + esc(t.Backdrop) : "") + '" data-name="' + esc(t.Name) + '" title="' + esc(t.Name) + '" style="' + bg + '">' + inner + "</div>"
        }
        var GRID_ROWS = {
            trending: 1,
            popular_movie: 1,
            upcoming_movie: 1,
            popular_tv: 1,
            upcoming_tv: 1
        };
        var CIRCLE_ARROW = '<svg class="dcRowGo" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.3 7.3a1 1 0 0 0 0 1.4l3.3 3.3-3.3 3.3a1 1 0 1 0 1.4 1.4l4-4a1 1 0 0 0 0-1.4l-4-4a1 1 0 0 0-1.4 0z" fill="currentColor"/></svg>';

        function rowTitleHtml(rowKey, title) {
            if (!GRID_ROWS[rowKey]) {
                return '<div class="dcRowTitle">' + esc(title) + "</div>"
            }
            return '<div class="dcRowTitle dcRowLink focusable" tabindex="0" role="button" data-rowkey="' + esc(rowKey) + '" data-title="' + esc(title) + '">' + "<span>" + esc(title) + "</span>" + CIRCLE_ARROW + "</div>"
        }
        var browse = null;

        function langName(code) {
            try {
                if (window.Intl && Intl.DisplayNames) {
                    var dn = new Intl.DisplayNames([uiLanguage === "nl" ? "nl" : uiLanguage === "de" ? "de" : uiLanguage === "no" ? "nb" : "en"], {
                        type: "language"
                    });
                    return dn.of(code) || code
                }
            } catch (e) {}
            return code
        }

        // Tv: keuzelijsten en vinkjes zijn met de afstandsbediening niet te bedienen (oude webOS),
        // dus daar komen knoppen voor in de plaats. OK = volgende keuze / aan-uit.
        function tvFilterButtons() {
            var bar = content.querySelector(".dcFilters");
            if (!isTvClient || !bar || bar.__dcTv) {
                return
            }
            bar.__dcTv = true;
            bar.classList.add("dcFTv");
            Array.prototype.forEach.call(bar.querySelectorAll("select"), function(sel) {
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "dcFCycle focusable";
                btn.__dcSel = sel;
                sel.style.display = "none";
                sel.parentNode.insertBefore(btn, sel);
                btn.addEventListener("click", function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var n = sel.options.length;
                    if (!n) {
                        return
                    }
                    sel.selectedIndex = (sel.selectedIndex + 1) % n;
                    sel.dispatchEvent(new Event("change", {
                        bubbles: true
                    }));
                    syncTvFilterButtons()
                })
            });
            Array.prototype.forEach.call(bar.querySelectorAll(".dcFCheck"), function(lab) {
                var cb = lab.querySelector("input");
                if (!cb) {
                    return
                }
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "dcFCycle dcFToggle focusable";
                btn.__dcCb = cb;
                btn.textContent = lab.textContent.trim();
                lab.style.display = "none";
                lab.parentNode.insertBefore(btn, lab);
                btn.addEventListener("click", function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event("change", {
                        bubbles: true
                    }));
                    syncTvFilterButtons()
                })
            });
            syncTvFilterButtons()
        }

        function syncTvFilterButtons() {
            Array.prototype.forEach.call(content.querySelectorAll(".dcFilters .dcFCycle"), function(btn) {
                if (btn.__dcSel) {
                    var o = btn.__dcSel.options[btn.__dcSel.selectedIndex];
                    btn.textContent = o ? o.textContent : "";
                } else if (btn.__dcCb) {
                    btn.classList.toggle("on", !!btn.__dcCb.checked)
                }
            })
        }

        function updateLangOptions(b) {
            var sel = content.querySelector(".dcFLang");
            if (!sel || browse !== b) {
                return
            }
            var have = {};
            Array.prototype.forEach.call(sel.options, function(o) {
                have[o.value] = true
            });
            Object.keys(b.langs).sort(function(x, y) {
                return b.langs[y] - b.langs[x]
            }).forEach(function(code) {
                if (have[code]) {
                    return
                }
                var o = document.createElement("option");
                o.value = code;
                o.textContent = langName(code);
                sel.appendChild(o)
            });
            syncTvFilterButtons()
        }

        function passes(i, f) {
            if (f.year && (!i.Year || (f.yearExact ? i.Year !== f.year : i.Year < f.year))) {
                return false
            }
            if (f.score && (!i.Rating || i.Rating < f.score)) {
                return false
            }
            if (f.lang && i.Lang !== f.lang) {
                return false
            }
            if (f.hideOwned && i.Status === 2) {
                return false
            }
            if (f.hideRequested && i.Status !== 0) {
                return false
            }
            return true
        }

        function applyFilters(b) {
            if (!b || browse !== b) {
                return
            }
            var grid = content.querySelector(".dcBrowseGrid");
            if (!grid) {
                return
            }
            var shown = 0,
                total = 0;
            Array.prototype.forEach.call(grid.querySelectorAll(".dcCard"), function(card) {
                var i = items[card.getAttribute("data-key")];
                var ok = !i || passes(i, b.filter);
                card.style.display = ok ? "" : "none";
                total++;
                if (ok) {
                    shown++
                }
            });
            var f = b.filter,
                active = f.year || f.score || f.lang || f.hideOwned || f.hideRequested;
            var cnt = content.querySelector(".dcFCount");
            if (cnt) {
                cnt.textContent = active ? shown + " / " + total : ""
            }
            if (active && shown < 12 && !b.done && !b.loading && b.auto < 6) {
                b.auto++;
                loadBrowse()
            }
        }
        content.addEventListener("change", function(e) {
            var b = browse;
            if (!b || !e.target || !e.target.closest || !e.target.closest(".dcFilters")) {
                return
            }
            var bar = content.querySelector(".dcFilters");
            var gSel = bar.querySelector(".dcFGenre"),
                sSel = bar.querySelector(".dcFSort");
            var yNew = parseInt(bar.querySelector(".dcFYear").value, 10) || 0;
            var gsChanged = !!(gSel && sSel && (parseInt(gSel.value, 10) !== (b.genre || 0) || sSel.value !== (b.sort || "popular")));
            var yChanged = !!(b.srvYear && yNew !== (b.year || 0));
            var mSel = bar.querySelector(".dcFMedia");
            var mChanged = !!(mSel && mSel.value !== (b.media || ""));
            if (mChanged) {
                b.media = mSel.value || ""
            }
            if (gsChanged || yChanged || mChanged) {
                if (gsChanged) {
                    b.genre = parseInt(gSel.value, 10) || 0;
                    b.sort = sSel.value || "popular"
                }
                b.year = b.srvYear ? yNew : 0;
                b.next = 1;
                b.done = false;
                b.seen = {};
                b.langs = {};
                b.auto = 0;
                b.seenAny = false;
                var grid = content.querySelector(".dcBrowseGrid");
                if (grid) {
                    grid.innerHTML = ""
                }
                var more = content.querySelector(".dcMore");
                if (more) {
                    more.style.display = "block"
                }
                if (b.loading) {
                    b.loading = false
                }
                b.req = (b.req || 0) + 1;
                loadBrowse()
            }
            b.filter = {
                year: yNew,
                yearExact: !!b.upcoming,
                score: parseFloat(bar.querySelector(".dcFScore").value) || 0,
                lang: bar.querySelector(".dcFLang").value || "",
                hideOwned: !!bar.querySelector(".dcFOwned").checked,
                hideRequested: !!bar.querySelector(".dcFRequested").checked
            };
            b.auto = 0;
            applyFilters(b)
        });

        function personHtml(p) {
            var dep = p.Department === "Directing" ? text("Regisseur", "Director", "Regie") : p.Department === "Acting" ? text("Acteur", "Actor", "Schauspiel") : p.Department || "";
            return '<div class="dcPerson focusable" tabindex="0" role="button" data-pid="' + p.Id + '" data-name="' + esc(p.Name) + '">' + '<div class="dcPersonPhoto"' + (p.Photo ? ' style="background-image:url(&quot;' + esc(p.Photo) + '&quot;)"' : "") + "></div>" + '<div class="dcPersonName">' + esc(p.Name) + "</div>" + (dep ? '<div class="dcPersonDep">' + esc(dep) + "</div>" : "") + "</div>"
        }

        function findEmbyPerson(pid, name) {
            var uid = ApiClient.getCurrentUserId();
            return Promise.resolve(ApiClient.getJSON(ApiClient.getUrl("Persons", {
                SearchTerm: name || "",
                UserId: uid,
                Fields: "ProviderIds",
                Limit: 30
            }))).then(function(r) {
                var list = r && r.Items || [];
                var exact = null;
                for (var k = 0; k < list.length; k++) {
                    var t = list[k].ProviderIds && (list[k].ProviderIds.Tmdb || list[k].ProviderIds.tmdb);
                    if (t && String(t) === String(pid)) {
                        return list[k]
                    }
                    if (!exact && String(list[k].Name || "").toLowerCase() === String(name || "").toLowerCase()) {
                        exact = list[k]
                    }
                }
                return exact
            }, function() {
                return null
            })
        }

        function ownedByPerson(person) {
            if (!person) {
                return Promise.resolve([])
            }
            var uid = ApiClient.getCurrentUserId();
            return Promise.resolve(libraryQuery({
                PersonIds: person.Id,
                Recursive: true,
                IncludeItemTypes: "Movie,Series",
                Fields: "ProviderIds,ProductionYear,CommunityRating",
                SortBy: "PremiereDate,SortName",
                SortOrder: "Descending",
                Limit: 200
            }, null)).then(function(r) {
                return r && r.Items || []
            }, function() {
                return []
            })
        }

        function fmtDay(d) {
            if (!d) {
                return ""
            }
            var dt = new Date(d + "T12:00:00");
            if (isNaN(dt.getTime())) {
                return d
            }
            try {
                return dt.toLocaleDateString(uiLanguage === "nl" ? "nl-NL" : uiLanguage === "de" ? "de-DE" : uiLanguage === "no" ? "nb-NO" : "en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                })
            } catch (e) {
                return d
            }
        }

        function ageOn(birth, end) {
            var b = new Date(birth + "T12:00:00"),
                e2 = end ? new Date(end + "T12:00:00") : new Date;
            if (isNaN(b.getTime()) || isNaN(e2.getTime())) {
                return null
            }
            var a = e2.getFullYear() - b.getFullYear();
            if (e2.getMonth() < b.getMonth() || e2.getMonth() === b.getMonth() && e2.getDate() < b.getDate()) {
                a--
            }
            return a
        }

        function personRow(title, keyName, list, embyIds) {
            if (!list.length) {
                return ""
            }
            return '<div class="dcRowTitle">' + esc(title) + ' <span class="dcRowCount">' + list.length + "</span></div>" + rowWrapHtml('<div class="dcRow" data-row="' + esc(keyName) + '">' + list.map(function(i) {
                return cardHtml(i, false, embyIds ? embyIds[key(i)] : null)
            }).join("") + "</div>")
        }

        function updateBioMore() {
            var bio = content.querySelector(".dcPersonBio");
            if (!bio) {
                return
            }
            var bt = bio.querySelector(".dcBioText"),
                more = bio.querySelector(".dcBioMore");
            if (!bt || !more) {
                return
            }
            more.style.display = bio.classList.contains("open") || bt.scrollHeight > bt.clientHeight + 2 ? "" : "none"
        }
        var personFromLink = false;
        var personPrev = null;

        function scrollBox() {
            return view.querySelector(".scrollY") || document.scrollingElement || document.documentElement
        }

        function goBack(fromHeader) {
            if (trailerOverlay.classList.contains("open")) {
                closeTrailer();
                return true
            }
            if (overlay.classList.contains("open")) {
                closeModal();
                return true
            }
            var person = !!content.querySelector(".dcPersonHead");
            if (!fromHeader && personFromLink && person && window.history.length > 1) {
                personFromLink = false;
                window.history.back();
                return true
            }
            personFromLink = false;
            if (personPrev && person) {
                var prev = personPrev;
                personPrev = null;
                content.innerHTML = "";
                content.appendChild(prev.frag);
                browse = prev.browse;
                homeShown = prev.homeShown;
                try {
                    scrollBox().scrollTop = prev.top
                } catch (ignored) {}
                return true
            }
            personPrev = null;
            if (homeShown && !browse && !person) {
                return false
            }
            if (input.value) {
                input.value = ""
            }
            loadHome();
            try {
                scrollBox().scrollTop = 0
            } catch (ignored) {}
            return true
        }

        function goHome() {
            if (trailerOverlay.classList.contains("open")) {
                closeTrailer()
            }
            if (overlay.classList.contains("open")) {
                closeModal()
            }
            personPrev = null;
            personFromLink = false;
            if (input.value) {
                input.value = ""
            }
            clearTimeout(searchTimer);
            loadHome();
            try {
                scrollBox().scrollTop = 0
            } catch (ignored) {}
        }

        function openPerson(pid, name, fromLink) {
            personFromLink = !!fromLink;
            personPrev = null;
            if (!fromLink && content.firstChild) {
                var frag = document.createDocumentFragment();
                while (content.firstChild) {
                    frag.appendChild(content.firstChild)
                }
                personPrev = {
                    frag: frag,
                    browse: browse,
                    homeShown: homeShown,
                    top: scrollBox().scrollTop
                }
            }
            browse = null;
            homeShown = false;
            content.innerHTML = '<div class="dcBrowseHead"><button type="button" class="dcBack">&#10094; ' + text("Terug", "Back", "Zur\xfcck", "Tilbake") + "</button></div>" + '<div class="dcPersonHead"><div class="dcPersonBig"></div><div class="dcPersonText"><h2 class="dcPersonTitle">' + esc(name || "") + "</h2>" + '<div class="dcPersonMeta"></div><div class="dcPersonBio"></div></div></div>' + '<div class="dcPersonRows">' + skeletonHtml(2) + "</div>";
            var root = view.querySelector(".dcRoot");
            if (root) {
                root.scrollTop = 0
            }
            try {
                window.scrollTo(0, 0)
            } catch (e) {}
            var personInfo = api("GET", "Discover/Person", {
                Id: pid
            });
            personInfo.then(function(p) {
                if (!p || !p.Found || !content.querySelector(".dcPersonHead")) {
                    return
                }
                content.querySelector(".dcPersonTitle").textContent = p.Name || name || "";
                if (p.Photo) {
                    content.querySelector(".dcPersonBig").style.backgroundImage = 'url("' + p.Photo + '")'
                }
                var meta = [];
                if (p.Birthday) {
                    var age = ageOn(p.Birthday, p.Deathday);
                    meta.push(text("Geboren: ", "Born: ", "Geboren: ", "F\xf8dt: ") + fmtDay(p.Birthday) + (age != null && !p.Deathday ? " (" + text("leeftijd ", "age ", "Alter ", "alder ") + age + ")" : ""))
                }
                if (p.Deathday) {
                    meta.push(text("Overleden: ", "Died: ", "Gestorben: ", "D\xf8d: ") + fmtDay(p.Deathday) + (ageOn(p.Birthday, p.Deathday) != null ? " (" + ageOn(p.Birthday, p.Deathday) + ")" : ""))
                }
                if (p.PlaceOfBirth) {
                    meta.push(p.PlaceOfBirth)
                }
                content.querySelector(".dcPersonMeta").innerHTML = meta.map(function(m) {
                    return "<div>" + esc(m) + "</div>"
                }).join("");
                var bio = content.querySelector(".dcPersonBio");
                if (p.Biography) {
                    bio.innerHTML = '<div class="dcBioText">' + esc(p.Biography) + '</div><button type="button" class="dcBioMore">' + text("Meer", "More", "Mehr", "Mer") + "</button>";
                    var more = bio.querySelector(".dcBioMore");
                    setTimeout(updateBioMore, 0);
                    more.addEventListener("click", function() {
                        var open = bio.classList.toggle("open");
                        more.textContent = open ? text("Minder", "Less", "Weniger", "Mindre") : text("Meer", "More", "Mehr", "Mer")
                    })
                }
            }, function() {});
            var creditsP = api("GET", "Discover/PersonCredits", {
                TmdbPersonId: pid,
                Name: name
            });
            var ownedP = findEmbyPerson(pid, name).then(ownedByPerson);
            Promise.all([creditsP, ownedP, personInfo.then(null, function() {
                return null
            })]).then(function(res) {
                var who = res[2] || {};
                var box = content.querySelector(".dcPersonRows");
                if (!box) {
                    return
                }
                var list = res[0] && res[0].Items || [];
                var owned = res[1] || [];
                var ownedByTmdb = {},
                    embyIds = {},
                    mine = [];
                owned.forEach(function(o) {
                    var t = o.ProviderIds && (o.ProviderIds.Tmdb || o.ProviderIds.tmdb);
                    if (t) {
                        ownedByTmdb[(o.Type === "Series" ? "tv:" : "movie:") + t] = o
                    }
                });
                var films = [],
                    series = [];
                list.forEach(function(i) {
                    var o = ownedByTmdb[key(i)];
                    if (o) {
                        i.Status = 2;
                        embyIds[key(i)] = o.Id;
                        mine.push(i);
                        delete ownedByTmdb[key(i)];
                        return
                    }(i.Type === "tv" ? series : films).push(i)
                });
                Object.keys(ownedByTmdb).forEach(function(k) {
                    var o = ownedByTmdb[k];
                    var tag = o.ImageTags && o.ImageTags.Primary;
                    var it = {
                        TmdbId: parseInt(k.split(":")[1], 10),
                        Type: o.Type === "Series" ? "tv" : "movie",
                        Title: o.Name,
                        Year: o.ProductionYear || 0,
                        Poster: tag ? ApiClient.getScaledImageUrl(o.Id, {
                            type: "Primary",
                            maxHeight: 360,
                            tag: tag
                        }) : null,
                        Rating: o.CommunityRating || 0,
                        Status: 2
                    };
                    embyIds[key(it)] = o.Id;
                    mine.push(it)
                });

                function newest(a, b) {
                    return (b.Year || 0) - (a.Year || 0)
                }
                films.sort(newest);
                series.sort(newest);
                mine.sort(newest);
                var nm = who.Name || name || "";
                var dir = who.Department === "Directing";
                var withNl = dir ? " van " : " met ",
                    withEn = dir ? " by " : " with ",
                    withDe = dir ? " von " : " mit ",
                    withNo = dir ? " av " : " med ";
                var html = personRow(text("In je bibliotheek", "In your library", "In deiner Bibliothek", "I biblioteket ditt"), "person_lib", mine, embyIds) + personRow(text("Meer films" + withNl + nm, "More movies" + withEn + nm, "Weitere Filme" + withDe + nm, "Flere filmer" + withNo + nm), "person_movie", films) + personRow(text("Meer series" + withNl + nm, "More series" + withEn + nm, "Weitere Serien" + withDe + nm, "Flere serier" + withNo + nm), "person_tv", series);
                box.innerHTML = html || '<div class="dcMsg">' + text("Geen titels gevonden.", "No titles found.", "Keine Titel gefunden.") + "</div>";
                setTimeout(updateAllArrows, 0);
                var withBd = list.filter(function(i) {
                    return i.Backdrop
                }).sort(function(a, b) {
                    return (b.Rating || 0) - (a.Rating || 0)
                });
                if (withBd.length) {
                    setPageBackdrop(withBd[0].Backdrop)
                }
                if (isTvClient) {
                    var f = box.querySelector(".dcCard");
                    if (f) {
                        focusEl(f)
                    }
                }
            }, function() {
                var box = content.querySelector(".dcPersonRows");
                if (box) {
                    box.innerHTML = '<div class="dcMsg">' + text("Laden mislukt.", "Loading failed.", "Laden fehlgeschlagen.") + "</div>"
                }
            })
        }
        var homeRowsData = [];

        function genreTiles(tv) {
            var k = tv ? "genres_tv" : "genres_movie",
                out = [];
            homeRowsData.forEach(function(r) {
                if (r.Key === k) {
                    out = r.Tiles || []
                }
            });
            return out
        }

        function openRowGrid(rowKey, title) {
            openBrowse(null, null, title, rowKey)
        }

        var STREAMING_NETWORKS = [213, 2739, 1024, 2552, 453, 49, 4353];

        function openBrowse(kind, id, name, rowKey) {
            homeShown = false;
            browse = {
                kind: kind,
                id: id,
                row: rowKey || null,
                next: 1,
                loading: false,
                done: false,
                seen: {},
                langs: {},
                auto: 0,
                filter: {
                    year: 0,
                    score: 0,
                    lang: "",
                    hideOwned: false,
                    hideRequested: false
                },
                genre: 0,
                sort: "popular",
                year: 0,
                media: "",
                upcoming: rowKey === "upcoming_movie" || rowKey === "upcoming_tv",
                srvYear: !rowKey || rowKey === "popular_movie" || rowKey === "popular_tv" || rowKey === "upcoming_movie" || rowKey === "upcoming_tv"
            };
            var thisYear = new Date().getFullYear();
            var years = browse.upcoming ? [0, thisYear, thisYear + 1] : [0, 2025, 2020, 2015, 2010, 2e3, 1990];
            var popular = rowKey === "popular_movie" || rowKey === "popular_tv";
            var serverFilters = "";
            if (!rowKey && (kind === "studio" || kind === "network" && STREAMING_NETWORKS.indexOf(Number(id)) >= 0)) {
                serverFilters += "<label>" + text("Soort", "Type", "Art") + ' <select class="dcFMedia">' + '<option value="">' + text("Alles", "All", "Alle") + "</option>" + '<option value="movie">' + text("Films", "Movies", "Filme") + "</option>" + '<option value="tv">' + text("Series", "Series", "Serien") + "</option></select></label>"
            }
            if (popular) {
                var gs = genreTiles(rowKey === "popular_tv");
                serverFilters = "<label>" + text("Genre", "Genre", "Genre") + ' <select class="dcFGenre"><option value="0">' + text("alle", "all", "alle") + "</option>" + gs.map(function(g) {
                    return '<option value="' + esc(g.Id) + '">' + esc(g.Name) + "</option>"
                }).join("") + "</select></label>" + "<label>" + text("Sorteren", "Sort", "Sortieren") + ' <select class="dcFSort">' + '<option value="popular">' + text("Populair", "Popular", "Beliebt") + "</option>" + '<option value="new">' + text("Nieuwste", "Newest", "Neueste") + "</option>" + '<option value="top">' + text("Best beoordeeld", "Top rated", "Bestbewertet") + "</option></select></label>"
            }
            content.innerHTML = '<div class="dcBrowseHead"><button type="button" class="dcBack">&#10094; ' + text("Terug", "Back", "Zur\xfcck") + "</button>" + '<span class="dcBrowseTitle">' + esc(name) + "</span></div>" + '<div class="dcFilters">' + serverFilters + "<label>" + text("Jaar", "Year", "Jahr") + ' <select class="dcFYear">' + years.map(function(y) {
                return '<option value="' + y + '">' + (y ? y + (browse.upcoming ? "" : "+") : text("alle", "all", "alle")) + "</option>"
            }).join("") + "</select></label>" + "<label>" + text("Score", "Score", "Bewertung") + ' <select class="dcFScore"><option value="0">' + text("alle", "all", "alle") + '</option><option value="6">6+</option><option value="7">7+</option><option value="8">8+</option></select></label>' + "<label>" + text("Taal", "Language", "Sprache") + ' <select class="dcFLang"><option value="">' + text("alle", "all", "alle") + "</option></select></label>" + '<label class="dcFCheck"><input type="checkbox" class="dcFOwned" /> ' + text("Niet in mijn bibliotheek", "Not in my library", "Nicht in meiner Bibliothek") + "</label>" + '<label class="dcFCheck"><input type="checkbox" class="dcFRequested" /> ' + text("Nog niet aangevraagd", "Not requested yet", "Noch nicht angefordert") + "</label>" + '<span class="dcFCount"></span>' + "</div>" + '<div class="dcGrid dcBrowseGrid"></div>' + '<div class="dcMore"><button type="button" class="dcBtn dcMoreBtn">' + text("Meer laden", "Load more", "Mehr laden") + "</button></div>";
            tvFilterButtons();
            var root = view.querySelector(".dcRoot");
            if (root) {
                root.scrollTop = 0
            }
            watchMore();
            loadBrowse()
        }
        var moreObserver = null;

        function watchMore() {
            if (moreObserver) {
                moreObserver.disconnect();
                moreObserver = null
            }
            var more = content.querySelector(".dcMore");
            if (!more || !window.IntersectionObserver) {
                return
            }
            more.classList.add("dcAuto");
            moreObserver = new IntersectionObserver(function(entries) {
                if (entries.some(function(en) {
                        return en.isIntersecting
                    })) {
                    loadBrowse()
                }
            }, {
                rootMargin: "0px 0px 800px 0px"
            });
            moreObserver.observe(more)
        }

        function loadBrowse() {
            var b = browse;
            if (!b || b.loading || b.done) {
                return
            }
            b.loading = true;
            var btn = content.querySelector(".dcMoreBtn");
            if (btn) {
                btn.disabled = true;
                btn.textContent = text("Laden...", "Loading...", "Wird geladen...")
            }
            var call = b.row ? api("GET", "Discover/List", {
                Key: b.row,
                Page: b.next,
                Genre: b.genre || 0,
                Sort: b.sort || "",
                Year: b.year || 0
            }) : api("GET", "Discover/Browse", {
                Kind: b.kind,
                Id: b.id,
                Page: b.next,
                Year: b.year || 0,
                Media: b.media || ""
            });
            var reqNo = b.req || 0;
            call.then(function(r) {
                if (browse !== b || (b.req || 0) !== reqNo) {
                    return
                }
                var list = r && r.Items || [];
                var fresh = list.filter(function(i) {
                    if (b.seen[key(i)]) {
                        return false
                    }
                    b.seen[key(i)] = true;
                    return true
                });
                var grid = content.querySelector(".dcBrowseGrid");
                var firstPage = grid && !grid.children.length;
                if (grid && fresh.length) {
                    grid.insertAdjacentHTML("beforeend", fresh.map(function(i) {
                        return cardHtml(i)
                    }).join(""))
                }
                fresh.forEach(function(i) {
                    if (i.Lang) {
                        b.langs[i.Lang] = (b.langs[i.Lang] || 0) + 1
                    }
                });
                if (isTvClient && firstPage && grid.firstElementChild && !overlay.classList.contains("open")) {
                    focusEl(grid.firstElementChild)
                }
                b.next = r && r.NextPage || b.next + (b.row ? 1 : 2);
                b.loading = false;
                if (!list.length) {
                    b.done = true
                }
                var more = content.querySelector(".dcMore");
                if (more) {
                    more.style.display = b.done ? "none" : "block"
                }
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = text("Meer laden", "Load more", "Mehr laden")
                }
                updateLangOptions(b);
                applyFilters(b);
                if (moreObserver && more && !b.done) {
                    more.classList.add("dcAuto");
                    moreObserver.unobserve(more);
                    moreObserver.observe(more)
                }
                if (b.done && !b.seenAny && !fresh.length && grid && !grid.children.length) {
                    grid.innerHTML = '<div class="dcMsg">' + text("Geen resultaten.", "No results.", "Keine Ergebnisse.") + "</div>"
                }
            }, function() {
                b.loading = false;
                if (btn) {
                    var m = content.querySelector(".dcMore");
                    if (m) {
                        m.classList.remove("dcAuto")
                    }
                    btn.disabled = false;
                    btn.textContent = text("Opnieuw proberen", "Try again", "Erneut versuchen")
                }
            })
        }
        var rowState = {};

        function renderRows(rows) {
            var html = "";
            rowState = {};
            rows.forEach(function(r) {
                if (r.Kind === "tiles") {
                    if (!r.Tiles || !r.Tiles.length) {
                        return
                    }
                    html += '<div class="dcRowTitle">' + esc(r.Title) + "</div>" + rowWrapHtml('<div class="dcRow dcTileRow">' + r.Tiles.map(function(t) {
                        return tileHtml(r, t)
                    }).join("") + "</div>");
                    return
                }
                if (!r.Items || !r.Items.length) {
                    return
                }
                var seen = {};
                r.Items.forEach(function(i) {
                    seen[key(i)] = true
                });
                rowState[r.Key] = {
                    nextPage: r.NextPage || 4,
                    loading: false,
                    done: false,
                    seen: seen
                };
                html += rowTitleHtml(r.Key, r.Title) + rowWrapHtml('<div class="dcRow" data-row="' + esc(r.Key) + '">' + r.Items.map(function(i) {
                    return cardHtml(i)
                }).join("") + "</div>")
            });
            content.innerHTML = '<div class="dcTop"></div>' + (html || '<div class="dcMsg">' + text("Geen resultaten.", "No results.", "Keine Ergebnisse.") + "</div>");
            homeShown = true;
            renderMine();
            renderExtras();
            setTimeout(updateAllArrows, 0)
        }

        function maybeLoadMore(el) {
            var rowKey = el.getAttribute("data-row");
            var st = rowState[rowKey];
            if (!st || st.loading || st.done) {
                return
            }
            if (el.scrollLeft + el.clientWidth < el.scrollWidth - 700) {
                return
            }
            st.loading = true;
            api("GET", "Discover/List", {
                Key: rowKey,
                Page: st.nextPage
            }).then(function(r) {
                var list = r && r.Items || [];
                if (!list.length) {
                    st.done = true;
                    st.loading = false;
                    return
                }
                st.nextPage = r && r.NextPage || st.nextPage + 1;
                var fresh = list.filter(function(i) {
                    if (st.seen[key(i)]) {
                        return false
                    }
                    st.seen[key(i)] = true;
                    return true
                });
                if (fresh.length) {
                    el.insertAdjacentHTML("beforeend", fresh.map(function(i) {
                        return cardHtml(i)
                    }).join(""))
                }
                updateArrows(el.parentNode);
                st.loading = false;
                maybeLoadMore(el)
            }, function() {
                st.loading = false;
                st.done = true
            })
        }

        function loadHome() {
            browse = null;
            homeShown = false;
            content.innerHTML = skeletonHtml(3);
            loadMyRequests();
            loadExtras();
            scheduleQueue(0);
            api("GET", "Discover/Home").then(function(r) {
                var culture = String(r.LanguageAuto && document.documentElement.lang || r.Language || "").toLowerCase();
                uiLanguage = culture.indexOf("nl") === 0 ? "nl" : culture.indexOf("de") === 0 ? "de" : culture.indexOf("nb") === 0 || culture.indexOf("nn") === 0 || culture.indexOf("no") === 0 ? "no" : "en";
                input.placeholder = text("Films en series zoeken", "Search movies and series", "Filme und Serien suchen", "S\xf8k filmer og serier");
                if (r.Message) {
                    content.innerHTML = '<div class="dcMsg">' + esc(r.Message) + "</div>";
                    return
                }
                if (r.LanguageAuto) {
                    (r.Rows || []).forEach(function(row) {
                        row.Title = rowTitle(row.Key) || row.Title
                    })
                }
                if (browse || content.querySelector(".dcPersonHead")) {
                    loaded = true;
                    return
                }
                homeRowsData = r.Rows || [];
                renderRows(r.Rows || []);
                loaded = true;
                randomPageBackdrop();
                if (isTvClient && document.activeElement !== input && !overlay.classList.contains("open")) {
                    focusFirstItem()
                }
            }, function() {
                content.innerHTML = '<div class="dcMsg">' + text("Laden mislukt. Controleer of de plugin is bijgewerkt en Emby opnieuw is gestart.", "Loading failed. Check that the plugin is updated and Emby has been restarted.", "Laden fehlgeschlagen. Pr\xfcfe, ob das Plugin aktualisiert und Emby neu gestartet wurde.") + "</div>"
            })
        }

        function doSearch(q) {
            browse = null;
            homeShown = false;
            content.innerHTML = '<div class="dcRowTitle">' + text("Zoeken...", "Searching...", "Suchen...") + '</div><div class="dcSkelRow">' + skelCards(8) + "</div>";
            api("GET", "Discover/Search", {
                Query: q
            }).then(function(r) {
                var list = r.Items || [];
                var people = r.People || [];
                var html = "";
                if (people.length) {
                    html += '<div class="dcRowTitle">' + text("Personen", "People", "Personen") + "</div>" + rowWrapHtml('<div class="dcRow dcPeopleRow">' + people.map(personHtml).join("") + "</div>")
                }
                if (list.length) {
                    html += '<div class="dcRowTitle">' + text("Zoekresultaten", "Search results", "Suchergebnisse") + '</div><div class="dcGrid">' + list.map(function(i) {
                        return cardHtml(i)
                    }).join("") + "</div>"
                }
                content.innerHTML = html || '<div class="dcMsg">' + text('Niets gevonden voor "', 'Nothing found for "', 'Keine Ergebnisse f\xfcr "') + esc(q) + '".</div>';
                setTimeout(updateAllArrows, 0)
            })
        }

        function showToast(text, isErr) {
            toast.textContent = text;
            toast.className = "dcToast" + (isErr ? " err" : "");
            toast.style.display = "block";
            setTimeout(function() {
                toast.style.display = "none"
            }, 3500)
        }
        var delArmed = false,
            delArmTimer = null;

        function updateButton() {
            var b = overlay.querySelector(".dcBtn");
            var d = overlay.querySelector(".dcBtnDel");
            if (!current) {
                return
            }
            var k4 = overlay.querySelector(".dcBtn4k");
            if (k4) {
                k4.textContent = current.Type === "tv" ? text("Alle seizoenen in 4K", "All seasons in 4K", "Alle Staffeln in 4K") : text("4K aanvragen", "Request in 4K", "In 4K anfordern");
                k4.title = k4.textContent;
                k4.classList.toggle("show", !!fourK[current.Type === "tv" ? "tv" : "movie"]);
                k4.disabled = false
            }
            // Beheerders: per film kiezen wanneer Radarr gaat zoeken (minimum availability).
            var av = overlay.querySelector(".dcAvail");
            if (av) {
                var showAv = isAdmin && !isTvClient && current.Type !== "tv" && current.Status === 0 && radarrSet && window.__discoverRequestService !== "Seerr";
                if (showAv) {
                    av.innerHTML = "";
                    [
                        ["announced", text("Bij aankondiging", "Announced", "Angekündigt", "Annonsert")],
                        ["inCinemas", text("In de bioscoop", "In cinemas", "Im Kino", "På kino")],
                        ["released", text("Uitgebracht", "Released", "Veröffentlicht", "Utgitt")]
                    ].forEach(function(o) {
                        var op = document.createElement("option");
                        op.value = o[0];
                        op.textContent = o[1];
                        av.appendChild(op)
                    });
                    av.value = radarrAvail;
                    av.title = text("Minimale beschikbaarheid in Radarr: wanneer Radarr deze film gaat zoeken", "Minimum availability in Radarr: when Radarr starts looking for this movie", "Mindestverfügbarkeit in Radarr: ab wann Radarr nach diesem Film sucht", "Minimum tilgjengelighet i Radarr: når Radarr begynner å lete etter filmen")
                }
                av.classList.toggle("show", showAv)
            }
            var tb = overlay.querySelector(".dcBtnTrailer");
            tb.textContent = text("Trailer", "Trailer", "Trailer", "Trailer");
            tb.title = tb.textContent;
            tb.setAttribute("data-short", "Trailer");
            if (showTrailer) {
                tb.classList.add("show")
            } else {
                tb.classList.remove("show")
            }
            d.disabled = false;
            delArmed = false;
            d.classList.remove("armed");
            clearTimeout(delArmTimer);
            if (isAdmin && current.Status === 1) {
                d.textContent = text("Aanvraag annuleren", "Cancel request", "Anfrage abbrechen");
                d.title = d.textContent;
                d.setAttribute("data-short", text("Annuleren", "Cancel", "Abbrechen", "Avbryt"));
                d.setAttribute("data-kind", "cancel");
                d.classList.add("show")
            } else if (isAdmin && current.Status === 2) {
                d.textContent = text("Verwijderen", "Delete", "L\xf6schen");
                d.title = d.textContent;
                d.setAttribute("data-short", text("Verwijderen", "Delete", "L\xf6schen", "Slett"));
                d.setAttribute("data-kind", "delete");
                d.classList.add("show")
            } else {
                d.classList.remove("show")
            }
            if (current.Status === 2) {
                b.textContent = text("Beschikbaar", "Available", "Verf\xfcgbar");
                b.disabled = true
            } else if (current.Status === 1) {
                b.textContent = text("Aangevraagd", "Requested", "Angefordert");
                b.disabled = true
            } else {
                b.textContent = text("Aanvragen", "Request", "Anfragen", "Foresp\xf8r");
                b.disabled = false
            }
        }

        function refreshCards(i) {
            var nodes = view.querySelectorAll('.dcCard[data-key="' + key(i) + '"] .dcStatus');
            for (var n = 0; n < nodes.length; n++) {
                nodes[n].className = "dcStatus s" + i.Status;
                nodes[n].innerHTML = statusIcon(i.Status)
            }
        }
        var seasonCache = {};

        function requestSeasons(i, seasons, btn, is4k) {
            if (!i) {
                return
            }
            var all = !seasons || !seasons.length;
            var body = {
                Type: i.Type,
                TmdbId: i.TmdbId
            };
            if (!all) {
                body.Seasons = seasons
            }
            if (is4k) {
                body.Is4k = true
            }
            var avSel = overlay.querySelector(".dcAvail.show");
            if (avSel && i.Type !== "tv" && !is4k && i === current) {
                body.MinimumAvailability = avSel.value
            }
            btn.disabled = true;
            api("POST", "Discover/RequestItem", null, body).then(function(r) {
                if (r && r.Success) {
                    if (!is4k) {
                        i.Status = 1;
                        refreshCards(i)
                    }
                    showToast(i.Title + ": " + r.Message, false);
                    if (!is4k) {
                        afterRequest()
                    }
                } else {
                    showToast(text("Mislukt: ", "Failed: ", "Fehlgeschlagen: ") + (r && r.Message || text("onbekende fout", "unknown error", "unbekannter Fehler")), true)
                }
                btn.disabled = false;
                if (current === i) {
                    updateButton();
                    applySeasonStates(i)
                }
            }, function() {
                showToast(text("Aanvraag mislukt.", "Request failed.", "Anfrage fehlgeschlagen."), true);
                btn.disabled = false
            })
        }

        function placeTrailer(inSeasons) {
            var tb = overlay.querySelector(".dcBtnTrailer");
            var row = overlay.querySelector(".dcBtnRow");
            var box = overlay.querySelector(".dcSeasons");
            if (!tb || !row || !box) {
                return
            }
            var phone = window.matchMedia && window.matchMedia("(max-width: 600px)").matches && !overlay.classList.contains("dcTv");
            if (inSeasons && !phone && !isTvClient) {
                if (tb.parentNode !== box) {
                    box.appendChild(tb)
                }
            } else if (tb.parentNode !== row) {
                var main = row.querySelector(".dcBtn");
                row.insertBefore(tb, main ? main.nextSibling : row.firstChild)
            }
        }

        function seasonName(n) {
            return n === 0 ? text("Specials", "Specials", "Specials") : text("Seizoen ", "Season ", "Staffel ") + n
        }

        function seasonUsable(s) {
            return s.Number > 0 || (s.Number === 0 && showSpecials && s.EpisodeCount > 0)
        }

        function renderSeasonButtons(i, seasons) {
            var box = overlay.querySelector(".dcSeasons");
            placeTrailer(false);
            box.textContent = "";
            var list = (seasons || []).filter(function(s) {
                return seasonUsable(s)
            });
            if (i.Type !== "tv" || list.length === 0) {
                box.classList.remove("show");
                return
            }
            if (modernUi() && !isTvClient) {
                box.classList.remove("show");
                overlay.querySelector(".dcBtn").style.display = "";
                return
            }
            var label = document.createElement("div");
            label.className = "dcSeasonLabel";
            label.textContent = text("Kies een seizoen om aan te vragen", "Choose a season to request", "Staffel zum Anfordern w\xe4hlen");
            box.appendChild(label);
            var all = document.createElement("button");
            all.type = "button";
            all.className = "dcBtnSeason all";
            all.textContent = text("Alle seizoenen", "All seasons", "Alle Staffeln");
            all.addEventListener("click", function() {
                requestSeasons(current, null, all)
            });
            box.appendChild(all);
            list.forEach(function(s) {
                var b = document.createElement("button");
                b.type = "button";
                b.className = "dcBtnSeason";
                var ym0 = String(s.AirDate || "").match(/\d{4}/);
                b.setAttribute("data-year", ym0 ? ym0[0] : "");
                b.setAttribute("data-season", s.Number);
                b.innerHTML = seasonHtml(s.Number, ym0 ? ym0[0] : "", false);
                b.title = s.EpisodeCount ? s.EpisodeCount + " " + text("afl.", "eps.", "Folgen") : "";
                if (s.Upcoming) {
                    b.classList.add("dcSoon");
                    b.insertAdjacentHTML("beforeend", '<span class="dcSoonTag">' + esc(s.AirDate ? text("binnenkort", "coming soon", "demn\xe4chst", "snart") : "TBA") + "</span>");
                    b.title = s.AirDate ? text("Start ", "Starts ", "Start ", "Start ") + s.AirDate : text("Aangekondigd", "Announced", "Angek\xfcndigt", "Annonsert")
                }
                b.addEventListener("click", function() {
                    requestSeasons(current, [s.Number], b)
                });
                box.appendChild(b)
            });
            box.classList.add("show");
            placeTrailer(true);
            applySeasonStates(i);
            overlay.querySelector(".dcBtn").style.display = "none"
        }
        var ratingState = {
            tmdb: "",
            votes: "",
            omdb: ""
        };

        function paintRatings() {
            var rateEl = overlay.querySelector(".dcRatings");
            if (!rateEl) {
                return
            }
            // Met het nieuwe infoblok staan de scores bovenin dat blok, niet onder de titel.
            var boxEl = overlay.querySelector(".dcInfo.dcTable .dcIScores");
            rateEl.style.display = boxEl ? "none" : "";
            if (boxEl) {
                rateEl = boxEl
            }
            var v = ratingState.votes;
            rateEl.innerHTML = (ratingState.tmdb ? '<span class="dcRate tmdb" title="TMDB' + (v ? " \xb7 " + esc(v) + " " + esc(text("stemmen", "votes", "Stimmen", "stemmer")) : "") + '"><b>TMDB</b>' + esc(ratingState.tmdb) + (v ? " <i>(" + esc(v) + ")</i>" : "") + "</span>" : "") + ratingState.omdb
            if (boxEl) {
                // In het infoblok: de labels van IMDb, TMDB, Trakt, Letterboxd en Metacritic worden het icoontje van die site.
                var map = { imdb: "IMDb", tmdb: "TMDB", trakt: "Trakt", lb: "Letterboxd", mc: "Metacritic" };
                Array.prototype.forEach.call(boxEl.querySelectorAll(".dcRate"), function(el) {
                    // Tomaat en popcorn alleen hier (oude tv-browsers tonen geen emoji).
                    var eb = el.querySelector("b");
                    if (isTvClient) {
                        eb = null
                    }
                    if (eb && el.classList.contains("rt")) {
                        eb.textContent = "\ud83c\udf45"
                    } else if (eb && el.classList.contains("pop")) {
                        eb.textContent = "\ud83c\udf7f"
                    }
                    for (var c in map) {
                        if (el.classList.contains(c)) {
                            var b = el.querySelector("b");
                            if (b) {
                                b.innerHTML = favImg(map[c]);
                                b.className = "dcIcoB"
                            }
                        }
                    }
                })
            }
        }
        var libSeasons = {};

        // Seizoensnaam met jaartal; op een smal scherm staat het jaartal op een eigen regel (CSS).
        function seasonHtml(n, yr, have) {
            return (have ? "\u2713 " : "") + esc(seasonName(n)) + (yr ? '<span class="dcSYear"><span class="dcSP"> (</span>' + esc(yr) + '<span class="dcSP">)</span></span>' : "")
        }

        function applySeasonStates(i) {
            var have = libSeasons[i.TmdbId] || {};
            var btns = overlay.querySelectorAll(".dcBtnSeason[data-season]");
            for (var k = 0; k < btns.length; k++) {
                var n = parseInt(btns[k].getAttribute("data-season"), 10);
                var yr = btns[k].getAttribute("data-year");
                if (have[n]) {
                    btns[k].innerHTML = seasonHtml(n, yr, true);
                    btns[k].disabled = false;
                    btns[k].title = text("Al in je bibliotheek: klik om opnieuw aan te vragen", "Already in your library: click to request again", "Bereits in deiner Bibliothek: erneut anfordern")
                } else {
                    btns[k].innerHTML = seasonHtml(n, yr, false);
                    if (btns[k].classList.contains("dcSoon")) {
                        btns[k].insertAdjacentHTML("beforeend", '<span class="dcSoonTag">' + esc(yr ? text("binnenkort", "coming soon", "demn\xe4chst", "snart") : "TBA") + "</span>")
                    }
                    btns[k].disabled = false
                }
            }
        }

        // Live TV-opnames (OTA/DVR) tellen niet als "in je bibliotheek", ook niet in een gewone seriebibliotheek.
        var recIdsP = null,
            recIdsAt = 0;

        function recordingIds() {
            if (recIdsP && Date.now() - recIdsAt < 3e5) {
                return recIdsP
            }
            recIdsAt = Date.now();
            recIdsP = getJson("LiveTv/Recordings", {
                UserId: ApiClient.getCurrentUserId(),
                Limit: 2e4,
                EnableImages: false,
                EnableUserData: false
            }).then(function(r) {
                var set = {};
                (r && r.Items || []).forEach(function(it) {
                    if (it && it.Id) {
                        set[String(it.Id)] = true
                    }
                });
                return set
            }, function() {
                return {}
            });
            return recIdsP
        }

        function loadLibrarySeasons(i) {
            if (i.Type !== "tv") {
                return
            }
            if (libSeasons[i.TmdbId]) {
                applySeasonStates(i);
                return
            }
            findLibraryItem(i).then(function(libId) {
                if (!libId) {
                    libSeasons[i.TmdbId] = {};
                    return
                }
                var uid = ApiClient.getCurrentUserId();
                return Promise.all([recordingIds(), getJson("Users/" + uid + "/Items", {
                    ParentId: libId,
                    IncludeItemTypes: "Episode",
                    Recursive: true,
                    Fields: "ParentIndexNumber",
                    Limit: 5e3
                })]).then(function(res) {
                    var rec = res[0] || {},
                        r = res[1];
                    var states = {};
                    (r && r.Items || []).forEach(function(it) {
                        if (rec[String(it.Id)]) {
                            return
                        }
                        var n = parseInt(it.ParentIndexNumber, 10);
                        if (n > 0) {
                            states[n] = true
                        }
                    });
                    libSeasons[i.TmdbId] = states
                })
            }).then(function() {
                if (current === i) {
                    applySeasonStates(i)
                }
            }, function() {})
        }

        function loadSeasonButtons(i) {
            var box = overlay.querySelector(".dcSeasons");
            placeTrailer(false);
            box.textContent = "";
            box.classList.remove("show");
            overlay.querySelector(".dcBtn").style.display = "";
            if (i.Type !== "tv") {
                return
            }
            loadLibrarySeasons(i);
            if (seasonCache[i.TmdbId]) {
                renderSeasonButtons(i, seasonCache[i.TmdbId]);
                return
            }
            api("GET", "Discover/Seasons", {
                TmdbId: i.TmdbId
            }).then(function(r) {
                var s = r && r.Seasons || [];
                seasonCache[i.TmdbId] = s;
                if (current === i) {
                    renderSeasonButtons(i, s)
                }
            }, function() {})
        }
        var DC_TMDB = '<svg width="2em" height="2em" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190.24 81.52"><defs><linearGradient id="dc-tmdb-grad" y1="40.76" x2="190.24" y2="40.76" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#90cea1"/><stop offset="0.56" stop-color="#3cbec9"/><stop offset="1" stop-color="#00b3e5"/></linearGradient></defs><path fill="url(#dc-tmdb-grad)" d="M105.67,36.06h66.9A17.67,17.67,0,0,0,190.24,18.4h0A17.67,17.67,0,0,0,172.57.73h-66.9A17.67,17.67,0,0,0,88,18.4h0A17.67,17.67,0,0,0,105.67,36.06Zm-88,45h76.9A17.67,17.67,0,0,0,112.24,63.4h0A17.67,17.67,0,0,0,94.57,45.73H17.67A17.67,17.67,0,0,0,0,63.4H0A17.67,17.67,0,0,0,17.67,81.06ZM10.41,35.42h7.8V6.92h10.1V0H.31v6.9h10.1Zm28.1,0h7.8V8.25h.1l9,27.15h6l9.3-27.15h.1V35.4h7.8V0H66.76l-8.2,23.1h-.1L50.31,0H38.51ZM152.43,55.67a15.07,15.07,0,0,0-4.52-5.52,18.57,18.57,0,0,0-6.68-3.08,33.54,33.54,0,0,0-8.07-1h-11.7v35.4h12.75a24.58,24.58,0,0,0,7.55-1.15A19.34,19.34,0,0,0,148.11,77a16.27,16.27,0,0,0,4.37-5.5,16.91,16.91,0,0,0,1.63-7.58A18.5,18.5,0,0,0,152.43,55.67ZM145,68.6A8.8,8.8,0,0,1,142.36,72a10.7,10.7,0,0,1-4,1.82,21.57,21.57,0,0,1-5,.55h-4.05v-21h4.6a17,17,0,0,1,4.67.63,11.66,11.66,0,0,1,3.88,1.87A9.14,9.14,0,0,1,145,59a9.87,9.87,0,0,1,1,4.52A11.89,11.89,0,0,1,145,68.6Zm44.63-.13a8,8,0,0,0-1.58-2.62A8.38,8.38,0,0,0,185.63,64a10.31,10.31,0,0,0-3.17-1v-.1a9.22,9.22,0,0,0,4.42-2.82,7.43,7.43,0,0,0,1.68-5,8.42,8.42,0,0,0-1.15-4.65,8.09,8.09,0,0,0-3-2.72,12.56,12.56,0,0,0-4.18-1.3,32.84,32.84,0,0,0-4.62-.33h-13.2v35.4h14.5a22.41,22.41,0,0,0,4.72-.5,13.53,13.53,0,0,0,4.28-1.65,9.42,9.42,0,0,0,3.1-3,8.52,8.52,0,0,0,1.2-4.68A9.39,9.39,0,0,0,189.66,68.47ZM170.21,52.72h5.3a10,10,0,0,1,1.85.18,6.18,6.18,0,0,1,1.7.57,3.39,3.39,0,0,1,1.22,1.13,3.22,3.22,0,0,1,.48,1.82,3.63,3.63,0,0,1-.43,1.8,3.4,3.4,0,0,1-1.12,1.2,4.92,4.92,0,0,1-1.58.65,7.51,7.51,0,0,1-1.77.2h-5.65Zm11.72,20a3.9,3.9,0,0,1-1.22,1.3,4.64,4.64,0,0,1-1.68.7,8.18,8.18,0,0,1-1.82.2h-7v-8h5.9a15.35,15.35,0,0,1,2,.15,8.47,8.47,0,0,1,2.05.55,4,4,0,0,1,1.57,1.18,3.11,3.11,0,0,1,.63,2A3.71,3.71,0,0,1,181.93,72.72Z"/></svg>';

        function modernUi() {
            return isTvClient || !!window.matchMedia && window.matchMedia("(min-width:700px)").matches
        }

        var LINK_COLORS = {
            "Emby": "#52b54b",
            "TMDB": "#01b4e4",
            "IMDb": "#f5c518",
            "Trakt": "#ed1c24",
            "Letterboxd": "#00c030",
            "Rotten Tomatoes": "#fa320a",
            "TVmaze": "#3c948b"
        };
        // Het eigen icoontje (favicon) van elke website, via de favicondienst van Google.
        var SITE_DOMAINS = {
            "Emby": "emby.media",
            "TMDB": "themoviedb.org",
            "IMDb": "imdb.com",
            "Trakt": "trakt.tv",
            "Letterboxd": "letterboxd.com",
            "Rotten Tomatoes": "rottentomatoes.com",
            "TVmaze": "tvmaze.com",
            "Metacritic": "metacritic.com"
        };

        function favImg(name) {
            var d = SITE_DOMAINS[name];
            return d ? '<img class="dcFav" alt="" loading="lazy" src="https://www.google.com/s2/favicons?sz=64&domain=' + d + '">' : ""
        }
        var INFO_ICONS = {
            ticket: "\ud83c\udf9f\ufe0f",
            cloud: "\u2601\ufe0f",
            disc: "\ud83d\udcbf"
        };

        function addEmbyLink() {
            var box = overlay.querySelector(".dcTLinks"),
                ob = overlay.querySelector(".dcBtnOpen"),
                id = ob && ob.getAttribute("data-id");
            if (!box || !id || box.querySelector(".dcTLink.emby")) {
                return
            }
            var a = document.createElement("a");
            a.className = "dcTLink emby";
            a.href = "#";
            a.innerHTML = favImg("Emby");
            a.title = text("Openen in Emby", "Open in Emby", "In Emby \xf6ffnen");
            a.addEventListener("click", function(e) {
                e.preventDefault();
                ob.click()
            });
            box.insertBefore(a, box.firstChild)
        }

        // Infoblok als tabel (zoals Seerr): scores bovenin, label links / waarde rechts, links onderaan.
        // Lange lijsten (studio's) en een lange tabel klappen in achter "Meer tonen", zodat de popup past.
        function renderInfoTable(i, infoEl, r) {
            var MAX_ROWS = 999,
                more = text("Meer tonen", "Show more", "Mehr anzeigen", "Vis mer"),
                h = '<div class="dcIScores"></div>';
            if (r.Tagline) {
                h += '<div class="dcTTag">\u201c' + esc(r.Tagline) + '\u201d</div>'
            }
            (r.Rows || []).forEach(function(row, n) {
                var items = row.Items || [],
                    show = row.Show > 0 ? row.Show : items.length,
                    v = items.map(function(it, k) {
                        var pre = it.Flag ? '<img class="dcFlag" alt="" loading="lazy" src="https://flagcdn.com/w20/' + esc(it.Flag) + '.png">' : it.Icon && INFO_ICONS[it.Icon] && !isTvClient ? '<span class="dcTIcon">' + INFO_ICONS[it.Icon] + "</span>" : "";
                        return '<div class="dcTItem' + (k >= show ? " dcTExtra" : "") + '"' + (it.Hint ? ' title="' + esc(it.Hint) + '"' : "") + ">" + pre + esc(it.Text) + "</div>"
                    }).join("");
                if (items.length > show) {
                    v += '<button type="button" class="dcTMore" tabindex="-1">' + esc(more) + " \u2304</button>"
                }
                h += '<div class="dcTRow' + (n >= MAX_ROWS ? " dcTHide" : "") + '"><div class="dcTK">' + esc(row.Label) + '</div><div class="dcTV">' + v + "</div></div>"
            });
            if ((r.Rows || []).length > MAX_ROWS) {
                h += '<button type="button" class="dcTMoreRows" tabindex="-1">' + esc(more) + " \u2304</button>"
            }
            // Tv: externe sites openen in de app zelf en je komt niet meer terug; daar alleen de Emby-link.
            h += '<div class="dcTLinks">' + (isTvClient ? [] : r.Links || []).map(function(l) {
                return '<a class="dcTLink" target="_blank" rel="noopener" title="' + esc(l.Name) + '" href="' + esc(l.Url) + '">' + (favImg(l.Name) || esc(l.Name)) + "</a>"
            }).join("") + "</div>";
            infoEl.innerHTML = h;
            infoEl.classList.add("dcTable");
            Array.prototype.forEach.call(infoEl.querySelectorAll(".dcTMore"), function(b) {
                b.addEventListener("click", function() {
                    b.parentNode.classList.add("open");
                    b.parentNode.removeChild(b)
                })
            });
            var mr = infoEl.querySelector(".dcTMoreRows");
            if (mr) {
                mr.addEventListener("click", function() {
                    infoEl.classList.add("allRows");
                    mr.parentNode.removeChild(mr)
                })
            }
            addEmbyLink();
            paintRatings()
        }

        function renderInfoBox(i, infoEl, lines, r) {
            infoEl.classList.remove("dcTable", "allRows");
            var genres = "",
                rows = "",
                k, ln, m, vm, mt;
            for (k = 0; k < lines.length; k++) {
                ln = String(lines[k]);
                m = ln.match(/^([^:]{1,40}):\s*(.*)$/);
                if (m && /^genres$/i.test(m[1])) {
                    genres = m[2];
                    continue
                }
                if (m && /^tmdb/i.test(m[1])) {
                    vm = m[2].match(/\(\s*([\d.,]+)/);
                    if (vm) {
                        if (ratingState.tmdb) {
                            ratingState.votes = vm[1];
                            paintRatings()
                        } else {
                            mt = overlay.querySelector(".dcMeta");
                            mt.textContent = mt.textContent + " (" + vm[1] + ")"
                        }
                        continue
                    }
                }
                rows += m ? '<div class="dcIRow">' + esc(m[1]) + ": " + esc(m[2]) + "</div>" : '<div class="dcIRow">' + esc(ln) + "</div>"
            }
            var gEl = overlay.querySelector(".dcGenres");
            if (!gEl) {
                gEl = document.createElement("div");
                gEl.className = "dcGenres";
                var ov = overlay.querySelector(".dcOverview");
                ov.parentNode.insertBefore(gEl, ov.nextSibling)
            }
            gEl.innerHTML = genres ? genres.split(/\s*,\s*/).map(function(g) {
                return "<span>" + esc(g) + "</span>"
            }).join("") : "";
            if (r && r.Rows && r.Rows.length) {
                renderInfoTable(i, infoEl, r);
                return
            }
            rows += '<div class="dcIRow">ID: ' + esc(String(i.TmdbId)) + '</div><div class="dcISep"></div>';
            rows += '<a class="dcIProv" title="TMDB" href="https://www.themoviedb.org/' + (i.Type === "tv" ? "tv" : "movie") + "/" + esc(String(i.TmdbId)) + '" target="_blank" rel="noopener">' + DC_TMDB + "</a>";
            infoEl.innerHTML = rows
        }

        function closeSeasonPicker() {
            var p = document.querySelector(".dcPk");
            if (p && p.parentNode) {
                p.parentNode.removeChild(p)
            }
            document.removeEventListener("keydown", pickerKey, true)
        }

        function pickerKey(e) {
            if (e.key === "Escape" || e.keyCode === 27) {
                e.stopPropagation();
                closeSeasonPicker()
            }
        }

        function openSeasonPicker(i, list, reqBtn, is4k) {
            closeSeasonPicker();
            var have = libSeasons[i.TmdbId] || {};
            var rows = list.map(function(s) {
                var ym = String(s.AirDate || "").match(/\d{4}/);
                var tag = s.Upcoming ? text("binnenkort", "coming soon", "demn\xe4chst", "snart") : have[s.Number] ? text("In bibliotheek", "In library", "In Bibliothek") : "";
                return '<label class="dcPkOpt"><input type="checkbox" class="dcPkRow" value="' + s.Number + '"><span class="dcPkChk"></span><span class="dcPkLbl"><span>' + esc(seasonName(s.Number)) + "</span>" + ((ym || s.EpisodeCount) ? '<span class="dcPkEp">' + (ym ? ym[0] : "") + (ym && s.EpisodeCount ? " \xb7 " : "") + (s.EpisodeCount ? s.EpisodeCount + " " + esc(text("afl.", "eps.", "Folgen")) : "") + "</span>" : "") + "</span>" + (tag ? '<span class="dcPkTag">' + esc(tag) + "</span>" : "") + "</label>"
            }).join("");
            var root = document.createElement("div");
            root.className = "dcPk";
            root.innerHTML = '<div class="dcPkBack"></div><div class="dcPkPanel" role="dialog"><div class="dcPkHead"><h3>' + esc(text("Seizoenen kiezen", "Select seasons", "Staffeln w\xe4hlen")) + '</h3><button type="button" class="dcPkX">&#10005;</button></div>' + '<div class="dcPkList"><label class="dcPkOpt dcPkAll"><input type="checkbox" class="dcPkAllBox"><span class="dcPkChk"></span><span class="dcPkLbl">' + esc(text("Alles selecteren", "Select all", "Alle ausw\xe4hlen")) + "</span></label>" + rows + "</div>" + '<div class="dcPkFoot"><button type="button" class="dcPkGo" disabled>' + esc(text("Doorgaan", "Continue", "Weiter")) + "</button></div></div>";
            document.body.appendChild(root);
            var boxes = root.querySelectorAll(".dcPkRow"),
                allBox = root.querySelector(".dcPkAllBox"),
                go = root.querySelector(".dcPkGo"),
                gt = go.textContent;

            function sync() {
                var n = 0,
                    r = 0,
                    rt = 0,
                    k;
                for (k = 0; k < boxes.length; k++) {
                    boxes[k].parentNode.classList.toggle("on", boxes[k].checked);
                    if (parseInt(boxes[k].value, 10) > 0) {
                        rt++;
                        if (boxes[k].checked) {
                            r++
                        }
                    }
                    if (boxes[k].checked) {
                        n++
                    }
                }
                allBox.checked = rt > 0 && r === rt;
                allBox.parentNode.classList.toggle("on", allBox.checked);
                go.disabled = n === 0;
                go.textContent = gt + (n ? " (" + n + ")" : "")
            }
            allBox.addEventListener("change", function() {
                var k;
                for (k = 0; k < boxes.length; k++) {
                    if (parseInt(boxes[k].value, 10) > 0) {
                        boxes[k].checked = allBox.checked
                    }
                }
                sync()
            });
            root.querySelector(".dcPkList").addEventListener("change", function(e) {
                if (e.target !== allBox) {
                    sync()
                }
            });
            root.querySelector(".dcPkBack").addEventListener("click", closeSeasonPicker);
            root.querySelector(".dcPkX").addEventListener("click", closeSeasonPicker);
            go.addEventListener("click", function() {
                var nums = [],
                    k;
                for (k = 0; k < boxes.length; k++) {
                    if (boxes[k].checked) {
                        nums.push(parseInt(boxes[k].value, 10))
                    }
                }
                var specialsOn = nums.indexOf(0) >= 0,
                    regularTotal = 0;
                for (k = 0; k < boxes.length; k++) {
                    if (parseInt(boxes[k].value, 10) > 0) {
                        regularTotal++
                    }
                }
                closeSeasonPicker();
                requestSeasons(i, !specialsOn && nums.length === regularTotal ? null : nums, reqBtn, is4k)
            });
            document.addEventListener("keydown", pickerKey, true)
        }
        overlay.addEventListener("click", function(e) {
            var b = e.target && e.target.closest ? e.target.closest(".dcBtn, .dcBtn4k") : null;
            if (!b || !current || current.Type !== "tv" || !modernUi() || isTvClient) {
                return
            }
            var is4k = b.classList.contains("dcBtn4k");
            var list = (seasonCache[current.TmdbId] || []).filter(function(s) {
                return seasonUsable(s)
            });
            if (!list.length) {
                if (seasonCache[current.TmdbId]) {
                    return
                }
                e.stopPropagation();
                e.preventDefault();
                var cur = current;
                api("GET", "Discover/Seasons", {
                    TmdbId: cur.TmdbId
                }).then(function(r) {
                    var s = r && r.Seasons || [];
                    seasonCache[cur.TmdbId] = s;
                    var l2 = s.filter(function(x) {
                        return seasonUsable(x)
                    });
                    if (current !== cur) {
                        return
                    }
                    if (l2.length) {
                        openSeasonPicker(cur, l2, b, is4k)
                    } else {
                        b.click()
                    }
                }, function() {
                    seasonCache[cur.TmdbId] = []
                });
                return
            }
            e.stopPropagation();
            e.preventDefault();
            openSeasonPicker(current, list, b, is4k)
        }, true);

        var dcColMq = window.matchMedia ? window.matchMedia("(min-width:700px)") : null;
        // Brede popup: links beschrijving, genres, seizoenen en downloadstatus; rechts (vanaf de titel) infoblok en collectie; cast over de volle breedte onderaan.
        // Zo wordt de lege ruimte onder het infoblok gebruikt en hoeft de kaart niet te scrollen. Smal (en op TV) blijft de oude volgorde.
        function arrangeModalCols() {
            var info = overlay.querySelector(".dcModalInfo");
            if (!info) {
                return
            }
            // Tv (16:9) krijgt dezelfde twee kolommen als de pc, met eigen maten (dcTvCols).
            var wide = isTvClient || !!(dcColMq && dcColMq.matches);
            overlay.classList.toggle("dcTvCols", !!(wide && isTvClient));
            var L = info.querySelector(".dcColL"), R = info.querySelector(".dcColR");
            var pick = function(sel) {
                return info.querySelector(sel)
            };
            if (wide) {
                if (!L) {
                    L = document.createElement("div");
                    L.className = "dcColL";
                    R = document.createElement("div");
                    R.className = "dcColR";
                    info.insertBefore(L, pick(".dcBtnRow"));
                    info.insertBefore(R, pick(".dcBtnRow"))
                }
                info.classList.add("dcCols");
                var body = info.parentNode;
                if (body && body.classList) {
                    body.classList.add("dcColsOn")
                }
                // Kop: titel(logo) met de knoppen ernaast; passen ze er niet naast, dan schuiven ze eronder.
                var head = info.querySelector(".dcHeadRow");
                if (!head) {
                    head = document.createElement("div");
                    head.className = "dcHeadRow";
                    info.insertBefore(head, pick(".dcModalTitle"))
                }
                head.appendChild(pick(".dcModalTitle"));
                head.appendChild(pick(".dcBtnRow"));
                [".dcOverview", ".dcGenres", ".dcSeasons", ".dcQueue", ".dcCollection"].forEach(function(sel) {
                    var e = pick(sel);
                    if (e) {
                        L.appendChild(e)
                    }
                });
                [".dcInfo"].forEach(function(sel) {
                    var e = pick(sel);
                    if (e) {
                        R.appendChild(e)
                    }
                });
                var cw = pick(".dcCastWrap");
                if (cw && cw.parentNode !== info) {
                    info.insertBefore(cw, pick(".dcBtnRow"))
                }
            } else if (L) {
                var hd = info.querySelector(".dcHeadRow");
                if (hd) {
                    info.insertBefore(pick(".dcModalTitle"), hd);
                    info.appendChild(pick(".dcBtnRow"));
                    info.removeChild(hd)
                }
                if (info.parentNode && info.parentNode.classList) {
                    info.parentNode.classList.remove("dcColsOn")
                }
                var btnRow = pick(".dcBtnRow");
                [".dcInfo", ".dcOverview", ".dcGenres", ".dcCastWrap", ".dcCollection", ".dcQueue", ".dcSeasons"].forEach(function(sel) {
                    var e = pick(sel);
                    if (e) {
                        info.insertBefore(e, btnRow)
                    }
                });
                info.removeChild(L);
                info.removeChild(R);
                info.classList.remove("dcCols")
            }
        }
        if (dcColMq) {
            var dcColChange = function() {
                arrangeModalCols();
                if (overlay.classList.contains("open")) {
                    updateCastArrows()
                }
            };
            if (dcColMq.addEventListener) {
                dcColMq.addEventListener("change", dcColChange)
            } else if (dcColMq.addListener) {
                dcColMq.addListener(dcColChange)
            }
        }

        // Titellogo (TMDB/fanart.tv) in plaats van de titel als tekst. Pas wisselen als het plaatje geladen is,
        // zodat er nooit een leeg of kapot plaatje staat; het jaar schuift dan naar de regel eronder.
        // Logo uit de eigen Emby-bibliotheek (het logo dat de beheerder in Emby heeft gekozen), alleen als de titel er al in staat.
        function embyLogo(i) {
            if (!i || !i.TmdbId) {
                return Promise.resolve(null)
            }
            return libraryQuery({
                Recursive: true,
                IncludeItemTypes: i.Type === "tv" ? "Series" : "Movie",
                AnyProviderIdEquals: "tmdb." + i.TmdbId,
                Fields: "ProviderIds",
                Limit: 5
            }, i.Type === "tv").then(function(res) {
                var list = res && res.Items || [];
                for (var k = 0; k < list.length; k++) {
                    var it = list[k],
                        t = it.ProviderIds && (it.ProviderIds.Tmdb || it.ProviderIds.tmdb);
                    if (t && String(t) === String(i.TmdbId) && it.ImageTags && it.ImageTags.Logo) {
                        return ApiClient.getScaledImageUrl(it.Id, {
                            type: "Logo",
                            tag: it.ImageTags.Logo,
                            maxHeight: 300
                        })
                    }
                }
                return null
            }, function() {
                return null
            })
        }

        function showTitleLogo(i, url, fallback) {
            var img = new Image();
            img.onerror = function() {
                if (fallback && current === i) {
                    showTitleLogo(i, fallback, null)
                }
            };
            img.className = "dcTitleLogo";
            img.alt = i.Title + (i.Year ? " (" + i.Year + ")" : "");
            img.onload = function() {
                if (current !== i) {
                    return
                }
                var t = overlay.querySelector(".dcModalTitle");
                t.textContent = "";
                t.appendChild(img);
                t.classList.add("dcHasLogo");
                var m = overlay.querySelector(".dcMeta");
                if (i.Year && m && m.textContent.indexOf(String(i.Year)) !== 0) {
                    m.textContent = i.Year + "  \u00b7  " + m.textContent
                }
            };
            img.src = url
        }

        function openModal(i) {
            current = i;
            arrangeModalCols();
            scheduleQueue(0);
            overlay.querySelector(".dcModalBack").style.backgroundImage = i.Backdrop ? "url(" + i.Backdrop + ")" : "none";
            var img = overlay.querySelector(".dcModalPoster");
            img.src = i.Poster || "";
            img.style.visibility = i.Poster ? "visible" : "hidden";
            var titleEl = overlay.querySelector(".dcModalTitle");
            titleEl.textContent = i.Title + (i.Year ? " (" + i.Year + ")" : "");
            titleEl.classList.remove("dcHasLogo");
            var embyLogoP = embyLogo(i);
            overlay.querySelector(".dcMeta").textContent = text(i.Type === "tv" ? "Serie" : "Film", i.Type === "tv" ? "Series" : "Movie", i.Type === "tv" ? "Serie" : "Film") + (i.Rating && !modernUi() ? "  •  ★ " + i.Rating.toFixed(1) : "");
            var ovEl = overlay.querySelector(".dcOverview");
            ovEl.textContent = i.Overview || text("Geen beschrijving beschikbaar.", "No description available.", "Keine Beschreibung verf\xfcgbar.", "Ingen beskrivelse tilgjengelig.");
            ovEl.scrollTop = 0;
            ovEl.onscroll = function() {
                updateOverviewHint(ovEl)
            };
            setTimeout(function() {
                updateOverviewHint(ovEl)
            }, 0);
            var infoEl = overlay.querySelector(".dcInfo");
            infoEl.textContent = "";
            infoEl.classList.remove("dcTable", "allRows");
            var g0 = overlay.querySelector(".dcGenres");
            if (g0) {
                g0.innerHTML = ""
            }
            var castEl = overlay.querySelector(".dcCast");
            castEl.innerHTML = "";
            ratingState = {
                tmdb: modernUi() && i.Rating ? i.Rating.toFixed(1) : "",
                votes: "",
                omdb: ""
            };
            paintRatings();
            loadCollection(i);
            if (omdbOn) {
                api("GET", "Discover/Ratings", {
                    Type: i.Type,
                    TmdbId: i.TmdbId
                }).then(function(r) {
                    if (current !== i || !r) {
                        return
                    }
                    var h = "";
                    if (r.Imdb) {
                        h += '<span class="dcRate imdb" title="IMDb' + (r.ImdbVotes ? " \xb7 " + esc(r.ImdbVotes) + " " + esc(text("stemmen", "votes", "Stimmen", "stemmer")) : "") + '"><b>IMDb</b>' + esc(r.Imdb) + "</span>"
                    }
                    if (r.RottenTomatoes) {
                        h += '<span class="dcRate rt" title="Rotten Tomatoes"><b>RT</b>' + esc(r.RottenTomatoes) + "</span>"
                    }
                    if (r.Metacritic) {
                        var mc = parseInt(r.Metacritic, 10);
                        h += '<span class="dcRate mc' + (mc < 40 ? " low" : mc < 61 ? " mid" : "") + '" title="Metacritic"><b>MC</b>' + esc(r.Metacritic) + "</span>"
                    }
                    if (r.Audience) {
                        h += '<span class="dcRate pop" title="Rotten Tomatoes \xb7 ' + esc(text("publiek", "audience", "Publikum", "publikum")) + '"><b>POP</b>' + esc(r.Audience) + "</span>"
                    }
                    if (r.Letterboxd) {
                        h += '<span class="dcRate lb" title="Letterboxd (/5)"><b>LB</b>' + esc(r.Letterboxd) + "</span>"
                    }
                    if (r.Trakt) {
                        h += '<span class="dcRate trakt" title="Trakt"><b>Trakt</b>' + esc(r.Trakt) + "</span>"
                    }
                    ratingState.omdb = h;
                    paintRatings()
                }, function() {})
            }
            api("GET", "Discover/Info", {
                Type: i.Type,
                TmdbId: i.TmdbId
            }).then(function(r) {
                if (current !== i || !r) {
                    return
                }
                if (r.TitleLogo || r.Logo) {
                    embyLogoP.then(function(own) {
                        var src = own || r.Logo;
                        if (src) {
                            showTitleLogo(i, src, own ? r.Logo : null)
                        }
                    })
                }
                if (r.Lines && r.Lines.length) {
                    if (isTvClient && !(r.Rows && r.Rows.length)) {
                        infoEl.textContent = r.Lines.join("\n")
                    } else {
                        renderInfoBox(i, infoEl, r.Lines, r)
                    }
                }
                castEl.innerHTML = (r.Cast || []).map(function(p) {
                    var initials = String(p.Name || "?").split(/\s+/).map(function(w) {
                        return w.charAt(0)
                    }).slice(0, 2).join("");
                    return '<button type="button" class="dcCastP" data-pid="' + p.Id + '" data-name="' + esc(p.Name) + '" title="' + esc(p.Name) + '">' + '<div class="dcCastPh"' + (p.Photo ? ' style="background-image:url(&quot;' + esc(p.Photo) + '&quot;)">' : ">" + esc(initials)) + "</div>" + '<div class="dcCastN">' + esc(p.Name) + "</div>" + (p.Character ? '<div class="dcCastR">' + esc(p.Character) + "</div>" : "") + "</button>"
                }).join("");
                castEl.scrollLeft = 0;
                updateCastArrows();
                setTimeout(updateCastArrows, 300)
            }, function() {});
            var ob = overlay.querySelector(".dcBtnOpen");
            ob.classList.remove("show");
            ob.removeAttribute("data-id");
            ob.textContent = text("Openen in Emby", "Open in Emby", "In Emby \xf6ffnen");
            ob.title = ob.textContent;
            ob.setAttribute("data-short", "Emby");
            loadSeasonButtons(i);
            renderQueueInfo(i);
            updateButton();
            lastFocus = document.activeElement;
            overlay.classList.add("open");
            setTimeout(function() {
                var t = firstModalButton(overlay);
                if (t && t.focus) {
                    t.focus()
                }
            }, 60)
        }
        var embyMap = null;
        var mapPromise = null;

        function getJson(path, query) {
            return ApiClient.ajax({
                type: "GET",
                url: ApiClient.getUrl(path, query || {}),
                dataType: "json"
            })
        }
        var rootFolders = null;

        function norm(t) {
            return String(t || "").replace(/^[✓⏳]\s*/, "").trim().toLowerCase()
        }

        function mapItems(map, tv, list) {
            list.forEach(function(it) {
                var t = it.ProviderIds && (it.ProviderIds.Tmdb || it.ProviderIds.tmdb);
                if (t) {
                    map[(tv ? "tv:" : "movie:") + t] = it.Id
                }
                var n = norm(it.Name);
                if (n) {
                    map[(tv ? "tv" : "movie") + "#" + n + "#" + (it.ProductionYear || "")] = it.Id
                }
            })
        }

        function buildEmbyMap() {
            if (mapPromise) {
                return mapPromise
            }
            var uid = ApiClient.getCurrentUserId();
            mapPromise = getJson("Channels", {
                UserId: uid
            }).then(function(r) {
                var ch = (r && r.Items || []).filter(function(c) {
                    return /discover/i.test(c.Name || "")
                })[0];
                if (!ch) {
                    throw new Error("kanaal niet gevonden")
                }
                channelId = ch.Id;
                return getJson("Channels/" + ch.Id + "/Items", {
                    UserId: uid,
                    Limit: 50
                }).then(function(root) {
                    var folders = root && root.Items || [];
                    rootFolders = folders.map(function(f) {
                        return {
                            id: f.Id,
                            name: f.Name || "",
                            tv: /serie/i.test(f.Name || "")
                        }
                    });
                    var lists = rootFolders.filter(function(f) {
                        return !/genre|studio/i.test(f.name)
                    });
                    return Promise.all(lists.map(function(f) {
                        return getJson("Channels/" + ch.Id + "/Items", {
                            UserId: uid,
                            FolderId: f.id,
                            Fields: "ProviderIds",
                            Limit: 300
                        }).then(function(res) {
                            return {
                                tv: f.tv,
                                items: res && res.Items || []
                            }
                        }, function() {
                            return {
                                tv: f.tv,
                                items: []
                            }
                        })
                    }))
                })
            }).then(function(lists) {
                var map = {};
                lists.forEach(function(l) {
                    mapItems(map, l.tv, l.items)
                });
                embyMap = map;
                return map
            });
            mapPromise.then(null, function() {
                mapPromise = null
            });
            return mapPromise
        }
        var channelId = null;

        function lookup(map, i) {
            return map[key(i)] || map[i.Type + "#" + norm(i.Title) + "#" + (i.Year || "")] || null
        }

        function goToEmbyItem(id) {
            var fallback = function() {
                window.location.hash = "#!/item?id=" + encodeURIComponent(id) + "&serverId=" + encodeURIComponent(ApiClient.serverId())
            };
            ApiClient.getItem(ApiClient.getCurrentUserId(), id).then(function(item) {
                try {
                    require(["appRouter"], function(router) {
                        try {
                            router.showItem(item)
                        } catch (e) {
                            fallback()
                        }
                    }, fallback)
                } catch (e) {
                    fallback()
                }
            }, fallback)
        }

        // Alleen de gewone film- en seriebibliotheken, niet de opnames van Live TV (OTA/DVR): een opgenomen
        // serie telt dan niet als "in je bibliotheek". tv = true (series), false (films) of null (beide).
        var libViewsP = null;

        function libraryViews() {
            if (!libViewsP) {
                libViewsP = getJson("Users/" + ApiClient.getCurrentUserId() + "/Views").then(function(r) {
                    var ok = [];
                    (r && r.Items || []).forEach(function(v) {
                        var ct = String(v.CollectionType || "").toLowerCase();
                        if (ct === "livetv") {
                            return
                        }
                        if (!ct || ct === "tvshows" || ct === "movies" || ct === "mixed" || ct === "homevideos") {
                            ok.push({
                                id: v.Id,
                                ct: ct
                            })
                        }
                    });
                    return ok
                }, function() {
                    return []
                })
            }
            return libViewsP
        }

        function libraryQuery(q, tv) {
            var uid = ApiClient.getCurrentUserId();
            return libraryViews().then(function(views) {
                var vs = views.filter(function(v) {
                    return !v.ct || v.ct === "mixed" || v.ct === "homevideos" || (tv === null ? v.ct === "tvshows" || v.ct === "movies" : v.ct === (tv ? "tvshows" : "movies"))
                });
                if (!vs.length) {
                    return getJson("Users/" + uid + "/Items", q)
                }
                return Promise.all(vs.map(function(v) {
                    var qq = {};
                    for (var a in q) {
                        qq[a] = q[a]
                    }
                    qq.ParentId = v.id;
                    return getJson("Users/" + uid + "/Items", qq).then(null, function() {
                        return {
                            Items: []
                        }
                    })
                })).then(function(rs) {
                    var items = [];
                    rs.forEach(function(r) {
                        items = items.concat(r && r.Items || [])
                    });
                    return {
                        Items: items
                    }
                })
            })
        }

        function findLibraryItem(i) {
            var uid = ApiClient.getCurrentUserId();
            var tv = i.Type === "tv";
            var base = {
                Recursive: true,
                IncludeItemTypes: tv ? "Series" : "Movie",
                Fields: "ProviderIds",
                Limit: 20
            };

            function pick(res) {
                var list = res && res.Items || [];
                for (var k = 0; k < list.length; k++) {
                    var t = list[k].ProviderIds && (list[k].ProviderIds.Tmdb || list[k].ProviderIds.tmdb);
                    if (t && String(t) === String(i.TmdbId)) {
                        return list[k].Id
                    }
                }
                return null
            }
            var byId = {};
            for (var a in base) {
                byId[a] = base[a]
            }
            byId.AnyProviderIdEquals = "tmdb." + i.TmdbId;
            return libraryQuery(byId, tv).then(function(res) {
                var id = pick(res);
                if (id) {
                    return id
                }
                var bySearch = {};
                for (var b in base) {
                    bySearch[b] = base[b]
                }
                bySearch.SearchTerm = i.Title;
                return libraryQuery(bySearch, tv).then(pick)
            }).then(null, function() {
                return null
            })
        }
        var ua = navigator.userAgent || "";
        var isWebTv = /Web0S|webOS|Tizen|SMART-?TV|NetCast|HbbTV/i.test(ua);
        var de = document.documentElement;
        var isTvClient = isWebTv || !!(de && de.classList && de.classList.contains("layout-tv")) || /Android ?TV|GoogleTV|AFT[A-Z]|BRAVIA|SHIELD Android TV/i.test(ua);
        var lastFocus = null;
        if (isTvClient) {
            view.classList.add("dcTvPage")
        }

        function openItem(i) {
            if (isTvClient) {
                try {
                    openModal(i)
                } catch (err) {
                    showToast("Popup: " + (err && err.message ? err.message : err), true);
                    return
                }
                findLibraryItem(i).then(function(libId) {
                    if (!libId || current !== i) {
                        return
                    }
                    var ob = overlay.querySelector(".dcBtnOpen");
                    ob.setAttribute("data-id", libId);
                    ob.classList.add("show");
                    addEmbyLink()
                });
                return
            }
            findLibraryItem(i).then(function(libId) {
                if (libId && (i.Type === "tv" || isAdmin)) {
                    openModalWithEmbyLink(i, libId);
                    return
                }
                if (libId) {
                    goToEmbyItem(libId);
                    return
                }
                openChannelItem(i)
            })
        }

        function openModalWithEmbyLink(i, embyId) {
            openModal(i);
            var ob = overlay.querySelector(".dcBtnOpen");
            ob.setAttribute("data-id", embyId);
            ob.classList.add("show");
            addEmbyLink()
        }

        function openChannelItem(i) {
            buildEmbyMap().then(function(map) {
                var id = lookup(map, i);
                if (id && (i.Type === "tv" || isAdmin)) {
                    openModalWithEmbyLink(i, id);
                    return
                }
                if (id) {
                    goToEmbyItem(id);
                    return
                }
                openModal(i)
            }, function() {
                openModal(i)
            })
        }

        function closeModal() {
            overlay.classList.remove("open");
            current = null;
            if (lastFocus && lastFocus.focus) {
                try {
                    lastFocus.focus()
                } catch (e) {}
            }
        }

        function playTrailerOnTv(i, btn) {
            var noTrailer = text("Geen trailer beschikbaar voor deze titel.", "No trailer available for this title.", "Kein Trailer f\xfcr diesen Titel verf\xfcgbar.");

            function finish() {
                btn.disabled = false
            }

            function fail(msg) {
                finish();
                showToast(msg, true)
            }

            function reason(e) {
                return e && (e.message || e.statusText || e.name) ? e.message || e.statusText || e.name : String(e)
            }

            function playRemote(key) {
                var link = "https://www.youtube.com/watch?v=" + encodeURIComponent(key);
                require(["playbackManager"], function(pm) {
                    try {
                        var players = pm.getPlayers && pm.getPlayers() || [];
                        var canPlay = players.filter(function(p) {
                            try {
                                return p.canPlayUrl && p.canPlayUrl(link) && (!p.canPlayMediaType || p.canPlayMediaType("Video"))
                            } catch (e) {
                                return false
                            }
                        });
                        if (!canPlay.length) {
                            fail(text("Geen YouTube-speler beschikbaar. Spelers: ", "No YouTube player available. Players: ", "Kein YouTube-Player verf\xfcgbar. Player: ") + players.map(function(p) {
                                return p.id || p.name
                            }).join(", "));
                            return
                        }
                        setTimeout(finish, 15e3);
                        var res = pm.play({
                            items: [{
                                Name: i.Title + " - Trailer",
                                Type: "Trailer",
                                MediaType: "Video",
                                Url: link,
                                Path: link,
                                ServerId: ApiClient.serverId()
                            }]
                        });
                        if (res && typeof res.then === "function") {
                            res.then(finish, function(e) {
                                fail(text("Trailer afspelen mislukt: ", "Playing trailer failed: ", "Trailer-Wiedergabe fehlgeschlagen: ") + reason(e))
                            })
                        } else {
                            finish()
                        }
                    } catch (e) {
                        fail(text("Trailer afspelen mislukt: ", "Playing trailer failed: ", "Trailer-Wiedergabe fehlgeschlagen: ") + reason(e))
                    }
                }, function(e) {
                    fail(text("Emby-speler niet beschikbaar: ", "Emby player not available: ", "Emby-Player nicht verf\xfcgbar: ") + reason(e))
                })
            }
            showToast(text("Trailer laden...", "Loading trailer...", "Trailer wird geladen..."), false);
            api("GET", "Discover/TrailerKey", {
                Type: i.Type,
                TmdbId: i.TmdbId
            }).then(function(r) {
                if (!r || !r.Key) {
                    fail(noTrailer);
                    return
                }
                playRemote(r.Key)
            }, function(e) {
                fail(text("Trailer ophalen mislukt: ", "Fetching trailer failed: ", "Trailer abrufen fehlgeschlagen: ") + reason(e))
            })
        }
        var pageBd = {
            layers: view.querySelectorAll(".dcPageBdImg"),
            idx: 0,
            cur: "",
            timer: null,
            seq: 0
        };

        function pageBdAllowed() {
            try {
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && /enablebackdrops/i.test(k) && String(localStorage.getItem(k)) === "false") {
                        return false
                    }
                }
            } catch (e) {}
            return true
        }

        function setPageBackdrop(url) {
            if (url) {
                url = String(url).replace("/t/p/w780/", "/t/p/w1280/")
            }
            if (!url || url === pageBd.cur || !pageBd.layers.length || !pageBdAllowed()) {
                return
            }
            var token = ++pageBd.seq;
            var img = new Image;
            img.onload = function() {
                if (token !== pageBd.seq) {
                    return
                }
                pageBd.cur = url;
                var next = pageBd.layers[pageBd.idx = 1 - pageBd.idx];
                var prev = pageBd.layers[1 - pageBd.idx];
                next.style.backgroundImage = 'url("' + url.replace(/"/g, "%22") + '")';
                next.classList.add("on");
                prev.classList.remove("on")
            };
            img.src = url
        }

        function backdropOf(el) {
            if (!el || !el.closest) {
                return null
            }
            var card = el.closest(".dcCard");
            if (card) {
                var it = items[card.getAttribute("data-key")];
                return it && it.Backdrop
            }
            var tile = el.closest(".dcTile");
            return tile ? tile.getAttribute("data-bd") : null
        }

        function onBackdropHover(e) {
            var url = backdropOf(e.target);
            if (!url) {
                return
            }
            clearTimeout(pageBd.timer);
            pageBd.timer = setTimeout(function() {
                setPageBackdrop(url)
            }, 120)
        }
        content.addEventListener("mouseover", onBackdropHover);
        content.addEventListener("focusin", onBackdropHover);

        function randomPageBackdrop() {
            var all = Object.keys(items).map(function(k) {
                return items[k] && items[k].Backdrop
            }).filter(Boolean);
            if (all.length) {
                setPageBackdrop(all[Math.floor(Math.random() * all.length)])
            }
        }
        var quick = document.createElement("div");
        quick.className = "dcQuick";
        view.appendChild(quick);
        var quickJustOpened = 0;

        function closeQuick() {
            quick.classList.remove("open")
        }

        function openQuick(i, x, y) {
            var canRequest = i.Status === 0 || i.Type === "tv" && i.Status !== 1;
            quick.innerHTML = '<div class="dcQuickTitle">' + esc(i.Title) + (i.Year ? " (" + i.Year + ")" : "") + "</div>" + '<button type="button" class="req"' + (canRequest ? "" : " disabled") + ">" + (i.Type === "tv" ? text("Alle seizoenen aanvragen", "Request all seasons", "Alle Staffeln anfordern") : text("Aanvragen", "Request", "Anfordern")) + (i.Status === 2 && i.Type !== "tv" ? " ✓" : i.Status === 1 ? " ⏳" : "") + "</button>" + '<button type="button" class="det">' + text("Details en trailer", "Details and trailer", "Details und Trailer") + "</button>";
            quick.querySelector(".req").addEventListener("click", function() {
                closeQuick();
                requestSeasons(i, null, {
                    disabled: false
                })
            });
            quick.querySelector(".det").addEventListener("click", function() {
                closeQuick();
                openItem(i)
            });
            quick.classList.add("open");
            var w = quick.offsetWidth || 220,
                h = quick.offsetHeight || 120;
            quick.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + "px";
            quick.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + "px";
            quickJustOpened = Date.now();
            var first = quick.querySelector("button:not([disabled])");
            if (first && isTvClient) {
                first.focus()
            }
        }
        content.addEventListener("contextmenu", function(e) {
            var card = e.target.closest ? e.target.closest(".dcCard") : null;
            var i = card && items[card.getAttribute("data-key")];
            if (!i) {
                return
            }
            e.preventDefault();
            openQuick(i, e.clientX, e.clientY)
        });
        var pressTimer = null,
            pressStart = null;
        content.addEventListener("touchstart", function(e) {
            var card = e.target.closest ? e.target.closest(".dcCard") : null;
            var i = card && items[card.getAttribute("data-key")];
            if (!i || !e.touches || e.touches.length !== 1) {
                return
            }
            pressStart = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
            clearTimeout(pressTimer);
            pressTimer = setTimeout(function() {
                pressTimer = null;
                openQuick(i, pressStart.x, pressStart.y)
            }, 550)
        }, {
            passive: true
        });
        content.addEventListener("touchmove", function(e) {
            if (!pressTimer || !pressStart || !e.touches || !e.touches.length) {
                return
            }
            if (Math.abs(e.touches[0].clientX - pressStart.x) > 10 || Math.abs(e.touches[0].clientY - pressStart.y) > 10) {
                clearTimeout(pressTimer);
                pressTimer = null
            }
        }, {
            passive: true
        });
        content.addEventListener("touchend", function() {
            clearTimeout(pressTimer);
            pressTimer = null
        });
        document.addEventListener("click", function(e) {
            if (!quick.classList.contains("open")) {
                return
            }
            if (quick.contains(e.target)) {
                return
            }
            closeQuick()
        }, true);
        document.addEventListener("keydown", function(e) {
            if ((e.key === "Escape" || e.keyCode === 27) && quick.classList.contains("open")) {
                closeQuick()
            }
        });
        window.addEventListener("scroll", closeQuick, true);
        content.addEventListener("click", function(e) {
            if (Date.now() - quickJustOpened < 700) {
                return
            }
            var card = e.target.closest ? e.target.closest(".dcCard") : null;
            if (card && card.getAttribute("data-emby")) {
                var embyItem = items[card.getAttribute("data-key")];
                if (isAdmin && embyItem) {
                    openModalWithEmbyLink(embyItem, card.getAttribute("data-emby"));
                    return
                }
                goToEmbyItem(card.getAttribute("data-emby"));
                return
            }
            if (card && items[card.getAttribute("data-key")]) {
                openItem(items[card.getAttribute("data-key")])
            }
        });
        content.addEventListener("click", function(e) {
            var t = e.target;
            var person = t.closest ? t.closest(".dcPerson") : null;
            if (person) {
                openPerson(parseInt(person.getAttribute("data-pid"), 10), person.getAttribute("data-name"));
                return
            }
            var reqAll = t.closest ? t.closest(".dcReqAll") : null;
            if (reqAll) {
                requestAll(reqAll.getAttribute("data-row"), reqAll);
                return
            }
            var rowLink = t.closest ? t.closest(".dcRowLink") : null;
            if (rowLink) {
                openRowGrid(rowLink.getAttribute("data-rowkey"), rowLink.getAttribute("data-title"));
                return
            }
            var tile = t.closest ? t.closest(".dcTile") : null;
            if (tile) {
                openBrowse(tile.getAttribute("data-kind"), parseInt(tile.getAttribute("data-id"), 10), tile.getAttribute("data-name"));
                return
            }
            if (t.closest && t.closest(".dcBack")) {
                goBack(false);
                return
            }
            if (t.closest && t.closest(".dcMoreBtn")) {
                loadBrowse()
            }
        });
        content.addEventListener("keydown", function(e) {
            var k = e.key || "";
            if (k !== "Enter" && k !== " " && e.keyCode !== 13 && e.keyCode !== 32) {
                return
            }
            var el = e.target;
            if (el && el.classList && (el.classList.contains("dcCard") || el.classList.contains("dcTile") || el.classList.contains("dcRowLink") || el.classList.contains("dcPerson"))) {
                e.preventDefault();
                el.click()
            }
        });
        content.addEventListener("focusin", function(e) {
            var el = e.target;
            if (el && el.classList && (el.classList.contains("dcCard") || el.classList.contains("dcTile") || el.classList.contains("dcPerson")) && el.scrollIntoView) {
                try {
                    el.scrollIntoView({
                        block: "nearest",
                        inline: "nearest"
                    })
                } catch (x) {
                    el.scrollIntoView()
                }
            }
        });
        content.addEventListener("scroll", function(e) {
            var el = e.target;
            if (el && el.classList && el.classList.contains("dcRow")) {
                maybeLoadMore(el);
                updateArrows(el.parentNode)
            }
        }, true);
        window.addEventListener("resize", function() {
            if (pageActive()) {
                updateAllArrows();
                updateBioMore()
            }
        });
        content.addEventListener("click", function(e) {
            var btn = e.target.closest ? e.target.closest(".dcArrow") : null;
            if (!btn) {
                return
            }
            var row = btn.parentNode.querySelector(".dcRow");
            if (!row) {
                return
            }
            var dir = parseInt(btn.getAttribute("data-dir"), 10) || 1;
            var amount = Math.max(300, row.clientWidth * .85) * dir;
            if (row.scrollBy) {
                row.scrollBy({
                    left: amount,
                    behavior: "smooth"
                })
            } else {
                row.scrollLeft += amount
            }
            setTimeout(function() {
                maybeLoadMore(row)
            }, 400)
        });
        overlay.querySelector(".dcClose").addEventListener("click", closeModal);
        var collectionCache = {};

        function loadCollection(i) {
            var box = overlay.querySelector(".dcCollection");
            box.innerHTML = "";
            if (!i || i.Type !== "movie") {
                return
            }
            var done = function(r) {
                collectionCache[i.TmdbId] = r || {};
                if (current === i) {
                    renderCollection(i, collectionCache[i.TmdbId])
                }
            };
            if (collectionCache[i.TmdbId]) {
                renderCollection(i, collectionCache[i.TmdbId]);
                return
            }
            api("GET", "Discover/Related", {
                Type: "movie",
                TmdbId: i.TmdbId
            }).then(done, function() {})
        }

        function colAllLabel(n) {
            return text("Collectie aanvragen (" + n + " films)", "Request collection (" + n + " movies)", "Sammlung anfragen (" + n + " Filme)", "Be om samlingen (" + n + " filmer)")
        }

        function colBadgeHtml(f) {
            if (f.Status === 2) {
                return '<span class="dcColBadge have" title="' + esc(text("In bibliotheek", "In library", "In Bibliothek", "I biblioteket")) + '">✓</span>'
            }
            if (f.Status === 1) {
                return '<span class="dcColBadge req" title="' + esc(text("Aangevraagd", "Requested", "Angefragt", "Forespurt")) + '">⏳</span>'
            }
            return ""
        }

        function colAddHtml(f, i) {
            if (f.Status !== 0 || f.TmdbId === i.TmdbId) {
                return ""
            }
            var t = text("Aanvragen", "Request", "Anfragen", "Foresp\xf8r") + ": " + f.Title;
            return '<button type="button" class="dcColAdd" data-req="' + f.TmdbId + '" title="' + esc(t) + '" aria-label="' + esc(t) + '">+</button>'
        }

        function renderCollection(i, r) {
            var box = overlay.querySelector(".dcCollection");
            var list = r && r.Collection || [];
            if (list.length < 2) {
                box.innerHTML = "";
                return
            }
            list.forEach(function(f) {
                f.Type = f.Type || "movie";
                items[key(f)] = items[key(f)] || f
            });
            var open = list.filter(function(f) {
                return f.Status === 0
            }).length;
            box.innerHTML = '<div class="dcColHead"><span class="dcColTitle">' + esc(r.CollectionName || text("Collectie", "Collection", "Sammlung", "Samling")) + " \xb7 " + list.length + " " + esc(text("films", "movies", "Filme", "filmer")) + "</span>" + (open ? '<button type="button" class="dcColAll" data-n="' + open + '">' + esc(colAllLabel(open)) + "</button>" : "") + "</div>" + (open ? '<div class="dcColWarn">⚠ ' + esc(text("Hiermee vraag je in \xe9\xe9n keer alle " + open + " films uit deze collectie aan die je nog niet hebt. Telt mee voor je aanvraaglimiet.", "This requests all " + open + " movies from this collection that you don’t have yet, in one go. Counts towards your request limit.", "Damit fragst du alle " + open + " Filme dieser Sammlung, die du noch nicht hast, auf einmal an. Z\xe4hlt zu deinem Anfragelimit.", "Dette ber om alle " + open + " filmer i denne samlingen som du ikke har enn\xe5, p\xe5 \xe9n gang. Teller mot foresp\xf8rselsgrensen.")) + "</div>" : "") + '<div class="dcColRow">' + list.map(function(f) {
                return '<div class="dcColItem' + (f.TmdbId === i.TmdbId ? " cur" : "") + '" data-tmdb="' + f.TmdbId + '">' + '<button type="button" class="dcColPoster" data-open="' + f.TmdbId + '" title="' + esc(f.Title + (f.Year ? " (" + f.Year + ")" : "")) + '"' + (f.Poster ? ' style="background-image:url(&quot;' + esc(f.Poster) + '&quot;)"' : "") + ">" + colBadgeHtml(f) + "</button>" + colAddHtml(f, i) + '<div class="dcColName">' + esc(f.Title) + (f.Year ? " (" + f.Year + ")" : "") + "</div>" + (f.TmdbId === i.TmdbId ? '<div class="dcColCur">' + esc(text("Deze film", "This movie", "Dieser Film", "Denne filmen")) + "</div>" : "") + "</div>"
            }).join("") + "</div>"
        }

        function colFind(id) {
            var r = current && collectionCache[current.TmdbId];
            var list = r && r.Collection || [];
            for (var k = 0; k < list.length; k++) {
                if (list[k].TmdbId === id) {
                    return list[k]
                }
            }
            return null
        }

        function requestColFilm(f) {
            return api("POST", "Discover/RequestItem", null, {
                Type: "movie",
                TmdbId: f.TmdbId
            }).then(function(r) {
                if (r && r.Success) {
                    f.Status = 1;
                    var it = items[key(f)];
                    if (it && it !== f) {
                        it.Status = 1
                    }
                    refreshCards(f);
                    return {
                        ok: true
                    }
                }
                return {
                    ok: false,
                    msg: r && r.Message || "?"
                }
            }, function(e) {
                return {
                    ok: false,
                    msg: e && (e.statusText || e.message) || "?"
                }
            })
        }
        overlay.querySelector(".dcCollection").addEventListener("click", function(e) {
            var t = e.target && e.target.closest ? e.target : null;
            if (!t) {
                return
            }
            var openBtn = t.closest(".dcColPoster");
            if (openBtn) {
                var f0 = colFind(parseInt(openBtn.getAttribute("data-open"), 10));
                if (f0 && current && f0.TmdbId !== current.TmdbId) {
                    openModal(items[key(f0)] || f0)
                }
                return
            }
            var reqBtn = t.closest(".dcColAdd[data-req]");
            if (reqBtn) {
                var f = colFind(parseInt(reqBtn.getAttribute("data-req"), 10));
                if (!f) {
                    return
                }
                reqBtn.disabled = true;
                reqBtn.textContent = "…";
                var cur = current;
                requestColFilm(f).then(function(res) {
                    if (res.ok) {
                        showToast(text("Aangevraagd: ", "Requested: ", "Angefragt: ", "Forespurt: ") + f.Title, false);
                        afterRequest()
                    } else {
                        showToast(res.msg, true)
                    }
                    if (current === cur) {
                        renderCollection(cur, collectionCache[cur.TmdbId])
                    }
                });
                return
            }
            var all = t.closest(".dcColAll");
            if (all) {
                var curItem = current;
                var r = collectionCache[curItem.TmdbId];
                var todo = (r && r.Collection || []).filter(function(x) {
                    return x.Status === 0
                });
                if (!todo.length) {
                    return
                }
                if (!all.classList.contains("confirm")) {
                    all.classList.add("confirm");
                    all.textContent = text("Zeker? " + todo.length + " films aanvragen", "Sure? Request " + todo.length + " movies", "Sicher? " + todo.length + " Filme anfragen", "Sikker? Be om " + todo.length + " filmer");
                    clearTimeout(all._t);
                    all._t = setTimeout(function() {
                        if (!all.disabled) {
                            all.classList.remove("confirm");
                            all.textContent = colAllLabel(todo.length)
                        }
                    }, 5e3);
                    return
                }
                clearTimeout(all._t);
                all.disabled = true;
                var ok = 0,
                    fail = 0,
                    lastErr = "";
                (function next(n) {
                    if (n >= todo.length) {
                        showToast(text(ok + " aangevraagd", ok + " requested", ok + " angefragt", ok + " forespurt") + (fail ? " \xb7 " + text(fail + " mislukt: ", fail + " failed: ", fail + " fehlgeschlagen: ", fail + " mislyktes: ") + lastErr : ""), fail > 0);
                        afterRequest();
                        if (current === curItem) {
                            renderCollection(curItem, r);
                            updateButton()
                        }
                        return
                    }
                    all.textContent = text("Aanvragen... ", "Requesting... ", "Wird angefragt... ", "Ber om... ") + (n + 1) + "/" + todo.length;
                    requestColFilm(todo[n]).then(function(res) {
                        if (res.ok) {
                            ok++
                        } else {
                            fail++;
                            lastErr = res.msg
                        }
                        if (!res.ok && /limi/i.test(res.msg || "")) {
                            n = todo.length
                        }
                        next(n + 1)
                    })
                })(0)
            }
        });

        function updateCastArrows() {
            var c = overlay.querySelector(".dcCast");
            var l = overlay.querySelector(".dcCastArr.left"),
                r = overlay.querySelector(".dcCastArr.right");
            if (!c || !l || !r) {
                return
            }
            var max = c.scrollWidth - c.clientWidth;
            l.classList.toggle("dcHide", c.scrollLeft <= 8);
            r.classList.toggle("dcHide", c.scrollLeft >= max - 8);
            // Zachte rand waar nog meer cast staat, zodat de rij niet "achter" de rechterkolom lijkt te verdwijnen.
            c.classList.toggle("dcFadeL", c.scrollLeft > 8);
            c.classList.toggle("dcFadeR", c.scrollLeft < max - 8)
        }(function() {
            var c = overlay.querySelector(".dcCast");
            var wrap = overlay.querySelector(".dcCastWrap");
            Array.prototype.forEach.call(overlay.querySelectorAll(".dcCastArr"), function(b) {
                b.innerHTML = b.classList.contains("left") ? CHEV_L : CHEV_R;
                b.addEventListener("click", function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var amount = Math.max(160, c.clientWidth * .8) * parseInt(b.getAttribute("data-dir"), 10);
                    if (c.scrollBy) {
                        c.scrollBy({
                            left: amount,
                            behavior: "smooth"
                        })
                    } else {
                        c.scrollLeft += amount
                    }
                })
            });
            c.addEventListener("scroll", updateCastArrows);
            wrap.addEventListener("mouseenter", updateCastArrows)
        })();
        overlay.querySelector(".dcCast").addEventListener("click", function(e) {
            var b = e.target.closest ? e.target.closest(".dcCastP") : null;
            if (!b) {
                return
            }
            var pid = parseInt(b.getAttribute("data-pid"), 10),
                name = b.getAttribute("data-name");
            if (!embedded) {
                closeModal();
                openPerson(pid, name);
                return
            }
            findEmbyPerson(pid, name).then(function(p) {
                closeModal();
                if (p) {
                    goToEmbyItem(p.Id);
                    return
                }
                try {
                    sessionStorage.setItem("dcOpenNext", JSON.stringify({
                        kind: "person",
                        id: pid,
                        name: name || "",
                        at: Date.now()
                    }))
                } catch (e) {}
                window.location.hash = "#!/configurationpage?name=" + UI_PAGE
            })
        });
        overlay.addEventListener("click", function(e) {
            if (e.target === overlay) {
                closeModal()
            }
        });
        overlay.querySelector(".dcBtn4k").addEventListener("click", function() {
            var i = current,
                b = this;
            if (!i || b.disabled) {
                return
            }
            b.disabled = true;
            api("POST", "Discover/RequestItem", null, {
                Type: i.Type,
                TmdbId: i.TmdbId,
                Is4k: true
            }).then(function(r) {
                showToast(r && r.Success ? i.Title + ": " + r.Message : text("Mislukt: ", "Failed: ", "Fehlgeschlagen: ") + (r && r.Message || "?"), !(r && r.Success));
                b.disabled = false
            }, function() {
                showToast(text("Aanvraag mislukt.", "Request failed.", "Anfrage fehlgeschlagen."), true);
                b.disabled = false
            })
        });
        overlay.querySelector(".dcBtn").addEventListener("click", function() {
            var i = current;
            if (!i || i.Status !== 0) {
                return
            }
            var b = this;
            b.disabled = true;
            b.textContent = text("Aanvragen...", "Requesting...", "Wird angefragt...");
            api("POST", "Discover/RequestItem", null, {
                Type: i.Type,
                TmdbId: i.TmdbId
            }).then(function(r) {
                if (r && r.Success) {
                    i.Status = 1;
                    refreshCards(i);
                    showToast(i.Title + ": " + r.Message, false);
                    afterRequest()
                } else {
                    showToast(text("Mislukt: ", "Failed: ", "Fehlgeschlagen: ") + (r && r.Message || text("onbekende fout", "unknown error", "unbekannter Fehler")), true)
                }
                updateButton()
            }, function() {
                showToast(text("Aanvraag mislukt.", "Request failed.", "Anfrage fehlgeschlagen."), true);
                updateButton()
            })
        });
        overlay.querySelector(".dcBtnDel").addEventListener("click", function() {
            var i = current;
            if (!i || i.Status === 0) {
                return
            }
            var arr = window.__discoverRequestService || (i.Type === "tv" ? "Sonarr" : "Radarr");
            var withFiles = i.Status === 2;
            var q = withFiles ? text('"' + i.Title + '" verwijderen uit ' + arr + " EN de bestanden van schijf verwijderen?", 'Delete "' + i.Title + '" from ' + arr + " AND delete its files from disk?", '"' + i.Title + '" aus ' + arr + " entfernen UND die Dateien von der Festplatte l\xf6schen?") : text('De aanvraag voor "' + i.Title + '" annuleren en verwijderen uit ' + arr + "?", 'Cancel the request for "' + i.Title + '" and remove it from ' + arr + "?", 'Die Anfrage f\xfcr "' + i.Title + '" abbrechen und aus ' + arr + " entfernen?");
            var d = this;
            if (!delArmed) {
                delArmed = true;
                d.classList.add("armed");
                d.textContent = withFiles ? text("Bevestig: verwijderen + bestanden", "Confirm: delete + files", "Best\xe4tigen: l\xf6schen + Dateien") : text("Bevestig: aanvraag annuleren", "Confirm: cancel request", "Best\xe4tigen: Anfrage abbrechen");
                showToast(q, false);
                clearTimeout(delArmTimer);
                delArmTimer = setTimeout(function() {
                    if (delArmed) {
                        updateButton()
                    }
                }, 6e3);
                return
            }
            delArmed = false;
            clearTimeout(delArmTimer);
            d.disabled = true;
            api("POST", "Discover/RemoveItem", null, {
                Type: i.Type,
                TmdbId: i.TmdbId,
                DeleteFiles: withFiles
            }).then(function(r) {
                if (r && r.Success) {
                    i.Status = 0;
                    refreshCards(i);
                    delete queue[key(i)];
                    applyQueueToCards();
                    loadMyRequests();
                    showToast(i.Title + ": " + r.Message, false)
                } else {
                    showToast(text("Mislukt: ", "Failed: ", "Fehlgeschlagen: ") + (r && r.Message || text("onbekende fout", "unknown error", "unbekannter Fehler")), true)
                }
                updateButton()
            }, function() {
                showToast(text("Verwijderen mislukt (alleen beheerders mogen dit).", "Delete failed (only administrators can do this).", "L\xf6schen fehlgeschlagen (nur Administratoren d\xfcrfen dies)."), true);
                updateButton()
            })
        });
        view.querySelector(".dcHomeBtn").addEventListener("click", goHome);
        input.addEventListener("input", function() {
            clearTimeout(searchTimer);
            var q = input.value.trim();
            searchTimer = setTimeout(function() {
                if (q.length < 2) {
                    if (loaded) {
                        loadHome()
                    }
                    return
                }
                doSearch(q)
            }, 400)
        });
        overlay.querySelector(".dcBtnOpen").addEventListener("click", function() {
            var id = this.getAttribute("data-id");
            if (!id) {
                return
            }
            closeModal();
            goToEmbyItem(id)
        });
        var trailerOverlay = view.querySelector(".dcTrailerOverlay");
        var trailerFrame = trailerOverlay.querySelector(".dcTrailerFrame");
        var trailerLink = trailerOverlay.querySelector(".dcTrailerLink");

        // Trailer echt stoppen: YouTube een stop-opdracht geven en het iframe vervangen door een leeg exemplaar.
        // Ook als de trailer op een andere manier verborgen wordt (zie de observer hieronder).
        function stopTrailerFrame() {
            if (!trailerFrame.getAttribute("src") || trailerFrame.getAttribute("src") === "about:blank") {
                return
            }
            try {
                trailerFrame.contentWindow.postMessage('{"event":"command","func":"stopVideo","args":""}', "*")
            } catch (ignored) {}
            var fresh = trailerFrame.cloneNode(false);
            fresh.removeAttribute("src");
            if (trailerFrame.parentNode) {
                trailerFrame.parentNode.replaceChild(fresh, trailerFrame)
            }
            trailerFrame = fresh
        }

        function closeTrailer() {
            trailerOverlay.classList.remove("open");
            stopTrailerFrame()
        }
        if (typeof MutationObserver === "function") {
            new MutationObserver(function() {
                if (!trailerOverlay.classList.contains("open")) {
                    stopTrailerFrame()
                }
            }).observe(trailerOverlay, {
                attributes: true,
                attributeFilter: ["class"]
            })
        }
        view.addEventListener("viewhide", function() {
            if (trailerOverlay.classList.contains("open")) {
                closeTrailer()
            }
        });

        function syncModalBody() {
            var open = Array.prototype.some.call(document.querySelectorAll(".dcOverlay.open, .dcTrailerOverlay.open"), function(o) {
                return o.getClientRects().length > 0
            });
            document.body.classList.toggle("dcModalOpen", open)
        }
        if (typeof MutationObserver === "function") {
            var modalObs = new MutationObserver(syncModalBody);
            modalObs.observe(overlay, {
                attributes: true,
                attributeFilter: ["class"]
            });
            modalObs.observe(trailerOverlay, {
                attributes: true,
                attributeFilter: ["class"]
            })
        }
        view.addEventListener("viewhide", function() {
            setTimeout(syncModalBody, 0)
        });
        window.addEventListener("hashchange", function() {
            setTimeout(syncModalBody, 0)
        });
        trailerOverlay.querySelector(".dcTrailerClose").addEventListener("click", closeTrailer);
        trailerOverlay.addEventListener("click", function(e) {
            if (!(e.target && e.target.closest && e.target.closest(".dcTrailerFrame, .dcTrailerLink"))) {
                closeTrailer()
            }
        });
        overlay.querySelector(".dcBtnTrailer").addEventListener("click", function() {
            var i = current;
            if (!i) {
                return
            }
            var b = this;
            b.disabled = true;
            if (location.protocol === "file:") {
                playTrailerOnTv(i, b);
                return
            }
            api("GET", "Discover/TrailerKey", {
                Type: i.Type,
                TmdbId: i.TmdbId
            }).then(function(r) {
                b.disabled = false;
                if (!r || !r.Key) {
                    showToast(text("Geen trailer beschikbaar voor deze titel.", "No trailer available for this title.", "Kein Trailer f\xfcr diesen Titel verf\xfcgbar."), true);
                    return
                }
                trailerFrame.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(r.Key) + "?autoplay=1&rel=0&playsinline=1&enablejsapi=1&origin=" + encodeURIComponent(window.location.origin);
                trailerLink.href = "https://www.youtube.com/watch?v=" + encodeURIComponent(r.Key);
                trailerLink.textContent = text("Werkt de trailer niet? Open op YouTube", "Trailer not playing? Open on YouTube", "Trailer l\xe4dt nicht? Auf YouTube \xf6ffnen");
                trailerOverlay.classList.add("open");
                setTimeout(function() {
                    trailerOverlay.querySelector(".dcTrailerClose").focus()
                }, 60)
            }, function() {
                b.disabled = false;
                showToast(text("Trailer ophalen mislukt.", "Fetching trailer failed.", "Trailer abrufen fehlgeschlagen."), true)
            })
        });
        view.addEventListener("focusin", function(e) {
            if (!overlay.classList.contains("open")) {
                return
            }
            var host = trailerOverlay.classList.contains("open") ? trailerOverlay : overlay;
            if (!host.contains(e.target)) {
                var t = firstModalButton(host);
                if (t) {
                    t.focus()
                }
            }
        });
        view.addEventListener("keydown", function(e) {
            var c = e.keyCode;
            if (c !== 27 && c !== 461 && c !== 10009) {
                return
            }
            if (trailerOverlay.classList.contains("open")) {
                e.preventDefault();
                e.stopPropagation();
                closeTrailer()
            } else if (overlay.classList.contains("open")) {
                e.preventDefault();
                e.stopPropagation();
                closeModal()
            }
        }, true);

        function isShown(el) {
            return !!(el && el.offsetParent !== null)
        }

        function isUsable(el) {
            return isShown(el) && !el.disabled
        }

        function modalButtons(host) {
            if (host === trailerOverlay) {
                return [trailerOverlay.querySelector(".dcTrailerClose")]
            }
            return Array.prototype.filter.call(overlay.querySelectorAll(".dcCollection button, .dcSeasons button, .dcBtnRow button"), isUsable)
        }

        function firstModalButton(host) {
            if (host !== trailerOverlay) {
                var main = Array.prototype.filter.call(overlay.querySelectorAll(".dcSeasons button, .dcBtnRow button"), isUsable);
                if (main.length) {
                    return main[0]
                }
            }
            return modalButtons(host)[0] || host.querySelector(".dcClose")
        }

        function focusEl(el) {
            if (!el) {
                return
            }
            try {
                el.focus({
                    preventScroll: true
                })
            } catch (e) {
                el.focus()
            }
            if (el.scrollIntoView) {
                try {
                    el.scrollIntoView({
                        block: "nearest",
                        inline: "nearest"
                    })
                } catch (x) {
                    el.scrollIntoView(false)
                }
            }
        }

        function navLines() {
            var lines = [];
            if (isShown(input)) {
                lines.push([input])
            }
            var parts = content.querySelectorAll(".dcBack, .dcFilters, .dcRow, .dcGrid, .dcMoreBtn");
            Array.prototype.forEach.call(parts, function(p) {
                if (!isShown(p)) {
                    return
                }
                if (p.classList.contains("dcFilters")) {
                    var fb = Array.prototype.filter.call(p.querySelectorAll(".dcFCycle"), isUsable);
                    if (fb.length) {
                        lines.push(fb)
                    }
                    return
                }
                if (p.classList.contains("dcBack") || p.classList.contains("dcMoreBtn")) {
                    if (isUsable(p)) {
                        lines.push([p])
                    }
                    return
                }
                var kids = Array.prototype.filter.call(p.children, function(c) {
                    return c.classList && (c.classList.contains("dcCard") || c.classList.contains("dcTile") || c.classList.contains("dcPerson"))
                });
                if (!kids.length) {
                    return
                }
                if (p.classList.contains("dcRow")) {
                    lines.push(kids);
                    return
                }
                var byTop = [],
                    tops = [];
                kids.forEach(function(c) {
                    var t = Math.round(c.offsetTop / 10);
                    var k = tops.indexOf(t);
                    if (k === -1) {
                        tops.push(t);
                        byTop.push([c])
                    } else {
                        byTop[k].push(c)
                    }
                });
                byTop.forEach(function(l) {
                    lines.push(l)
                })
            });
            return lines
        }

        function findInLines(lines, el) {
            for (var a = 0; a < lines.length; a++) {
                var b = lines[a].indexOf(el);
                if (b !== -1) {
                    return [a, b]
                }
            }
            return null
        }

        function closestInLine(line, x) {
            var best = null,
                bestD = Infinity,
                w = window.innerWidth || 1920;
            line.forEach(function(el) {
                var r = el.getBoundingClientRect();
                var inView = r.right > 0 && r.left < w;
                var d = Math.abs(r.left + r.width / 2 - x) + (inView ? 0 : 1e6);
                if (d < bestD) {
                    bestD = d;
                    best = el
                }
            });
            return best
        }

        function focusFirstItem() {
            var lines = navLines();
            var first = null;
            for (var a = 0; a < lines.length && !first; a++) {
                if (lines[a][0] !== input) {
                    first = lines[a][0]
                }
            }
            focusEl(first || input)
        }

        function navPage(dir, active) {
            var lines = navLines();
            var pos = findInLines(lines, active);
            if (!pos) {
                focusFirstItem();
                return true
            }
            var line = lines[pos[0]],
                i = pos[1];
            var r = active.getBoundingClientRect(),
                x = r.left + r.width / 2;
            if (dir === "left") {
                if (i > 0) {
                    focusEl(line[i - 1]);
                    return true
                }
                return false
            }
            if (dir === "right") {
                if (i < line.length - 1) {
                    focusEl(line[i + 1]);
                    var row = line[i + 1].parentNode;
                    if (row && row.classList.contains("dcRow")) {
                        setTimeout(function() {
                            maybeLoadMore(row)
                        }, 50)
                    }
                }
                return true
            }
            if (dir === "up") {
                if (pos[0] > 0) {
                    focusEl(closestInLine(lines[pos[0] - 1], x));
                    return true
                }
                return false
            }
            if (dir === "down") {
                if (pos[0] < lines.length - 1) {
                    focusEl(closestInLine(lines[pos[0] + 1], x))
                }
                return true
            }
            return false
        }

        function updateOverviewHint(el) {
            if (!el) {
                return
            }
            var more = el.scrollHeight - el.scrollTop - el.clientHeight > 2;
            el.classList.toggle("dcMoreBelow", more)
        }

        function scrollOverview(dir) {
            var el = overlay.querySelector(".dcOverview");
            if (!el || el.scrollHeight <= el.clientHeight + 2) {
                return false
            }
            var step = Math.max(40, Math.round(el.clientHeight * .6));
            if (dir === "down" && el.scrollTop + el.clientHeight < el.scrollHeight - 2) {
                el.scrollTop = Math.min(el.scrollHeight, el.scrollTop + step)
            } else if (dir === "up" && el.scrollTop > 0) {
                el.scrollTop = Math.max(0, el.scrollTop - step)
            } else {
                return false
            }
            setTimeout(function() {
                updateOverviewHint(el)
            }, 350);
            return true
        }

        function modalRows() {
            var q = function(sel) {
                return Array.prototype.filter.call(overlay.querySelectorAll(sel), isUsable)
            };
            return [q(".dcBtnRow button")].concat(seasonLines(), [q(".dcCollection .dcColAll"), q(".dcCollection .dcColPoster"), q(".dcCollection .dcColAdd"), q(".dcCast .dcCastP")]).filter(function(r) {
                return r.length > 0
            })
        }

        function seasonLines() {
            var lines = [];
            Array.prototype.filter.call(overlay.querySelectorAll(".dcSeasons button"), isUsable).forEach(function(b) {
                var mid = b.offsetTop + b.offsetHeight / 2,
                    last = lines[lines.length - 1],
                    f = last && last[0];
                if (f && mid >= f.offsetTop && mid <= f.offsetTop + f.offsetHeight) {
                    last.push(b)
                } else {
                    lines.push([b])
                }
            });
            return lines
        }

        function centerX(el) {
            var r = el.getBoundingClientRect();
            return r.left + r.width / 2
        }

        function nearestIn(row, from) {
            var x = centerX(from),
                best = row[0],
                bd = Infinity;
            row.forEach(function(el) {
                var d = Math.abs(centerX(el) - x);
                if (d < bd) {
                    bd = d;
                    best = el
                }
            });
            return best
        }
        var lastNavDone = 0;

        function navModal(dir, active) {
            try {
                navModalStep(dir, active)
            } finally {
                lastNavDone = Date.now()
            }
        }

        function navModalStep(dir, active) {
            if (trailerOverlay.classList.contains("open")) {
                focusEl(trailerOverlay.querySelector(".dcTrailerClose"));
                return
            }
            var rows = modalRows();
            var close = overlay.querySelector(".dcClose");
            if (active === close) {
                if (dir === "down") {
                    focusEl(rows[0] && rows[0][0] || firstModalButton(overlay))
                } else if (dir === "left") {
                    focusEl(firstModalButton(overlay))
                }
                return
            }
            var r = -1,
                c = -1;
            for (var k = 0; k < rows.length && r === -1; k++) {
                c = rows[k].indexOf(active);
                if (c !== -1) {
                    r = k
                }
            }
            if (r === -1) {
                focusEl(firstModalButton(overlay));
                return
            }
            var row = rows[r];
            if (dir === "left") {
                if (c > 0) {
                    focusEl(row[c - 1])
                }
            } else if (dir === "right") {
                if (c < row.length - 1) {
                    focusEl(row[c + 1])
                }
            } else if (dir === "down") {
                if (r < rows.length - 1) {
                    focusEl(nearestIn(rows[r + 1], active))
                } else {
                    scrollOverview("down")
                }
            } else if (dir === "up") {
                if (r > 0) {
                    focusEl(nearestIn(rows[r - 1], active))
                } else if (!scrollOverview("up")) {
                    focusEl(close)
                }
            }
            if (row[0] && row[0].classList.contains("dcCastP")) {
                setTimeout(updateCastArrows, 350)
            }
        }
        var keyDirs = {
            37: "left",
            38: "up",
            39: "right",
            40: "down",
            ArrowLeft: "left",
            ArrowUp: "up",
            ArrowRight: "right",
            ArrowDown: "down"
        };

        function onModalArrow(e) {
            var dir = keyDirs[e.key] || keyDirs[e.keyCode];
            if (!dir || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
                return
            }
            if (!document.body.contains(view) || !overlay.classList.contains("open") || !overlay.offsetWidth) {
                return
            }
            var tn = e.target && e.target.tagName;
            if (tn === "INPUT" || tn === "TEXTAREA" || tn === "SELECT") {
                return
            }
            e.preventDefault();
            e.stopImmediatePropagation();
            if (Date.now() - lastNavDone < 12) {
                return
            }
            navModal(dir, document.activeElement)
        }
        var modalKeysId = "__dcModalKeys" + (embedded ? "E" : "P");
        if (window[modalKeysId]) {
            window.removeEventListener("keydown", window[modalKeysId], true)
        }
        window[modalKeysId] = onModalArrow;
        window.addEventListener("keydown", onModalArrow, true);
        var lastKeyClick = 0;
        content.addEventListener("keydown", function(e) {
            if (e.key === "Enter" || e.keyCode === 13) {
                lastKeyClick = Date.now()
            }
        }, true);

        function onDiscoverRoute() {
            var h = (location.hash || "").toLowerCase();
            return h.indexOf("configurationpage") !== -1 && h.indexOf("discoverui") !== -1
        }

        function onCommand(e) {
            if (!isTvClient || !onDiscoverRoute() || !document.body.contains(view) || !isShown(view.querySelector(".dcRoot"))) {
                return
            }
            var cmd = e.detail && e.detail.command;
            var active = document.activeElement;
            var trailerOpen = trailerOverlay.classList.contains("open");
            var modalOpen = overlay.classList.contains("open") || trailerOpen;
            if (cmd === "back") {
                if (goBack(true)) {
                    e.preventDefault()
                } else if (topRoot && topRoot.scrollTop > 600) {
                    e.preventDefault();
                    toTop()
                }
                return
            }
            if (cmd === "select") {
                if (active && active.classList && (active.classList.contains("dcCard") || active.classList.contains("dcTile")) && Date.now() - lastKeyClick < 1500) {
                    e.preventDefault()
                }
                return
            }
            if (cmd !== "up" && cmd !== "down" && cmd !== "left" && cmd !== "right") {
                return
            }
            if (modalOpen) {
                e.preventDefault();
                navModal(cmd, active);
                return
            }
            if (active && active.closest && active.closest(".mainDrawer, .navDrawer, .drawer")) {
                return
            }
            if (active && active.closest && active.closest(".skinHeader")) {
                if (cmd === "down") {
                    e.preventDefault();
                    focusFirstItem()
                }
                return
            }
            if (!active || active === document.body || !view.contains(active)) {
                e.preventDefault();
                focusFirstItem();
                return
            }
            if (navPage(cmd, active)) {
                e.preventDefault()
            }
        }

        function syncHeader() {
            var on = onDiscoverRoute() && document.body.contains(view);
            document.body.classList.toggle("dcDiscoverActive", !!on)
        }

        function openByIds(type, tmdbId) {
            api("GET", "Discover/Title", {
                Type: type,
                TmdbId: tmdbId
            }).then(function(r) {
                if (!r || !r.Found || !r.Item) {
                    showToast(text("Titel niet gevonden.", "Title not found.", "Titel nicht gefunden."), true);
                    return
                }
                items[key(r.Item)] = r.Item;
                openItem(r.Item);
                setTimeout(function() {
                    scheduleQueue(0)
                }, 300)
            }, function() {
                showToast(text("Titel laden mislukt.", "Loading title failed.", "Titel konnte nicht geladen werden."), true)
            })
        }
        if (embedded) {
            view.__dcOpen = openByIds;
            view.__dcClose = function() {
                if (trailerOverlay.classList.contains("open")) {
                    closeTrailer()
                }
                closeModal()
            };
            view.__dcIsOpen = function() {
                return overlay.classList.contains("open") || trailerOverlay.classList.contains("open")
            };
            document.addEventListener("command", function(e) {
                if (!document.body.contains(view) || !view.__dcIsOpen()) {
                    return
                }
                var cmd = e.detail && e.detail.command;
                if (cmd === "back") {
                    e.preventDefault();
                    if (trailerOverlay.classList.contains("open")) {
                        closeTrailer()
                    } else {
                        closeModal()
                    }
                    return
                }
                if (cmd === "up" || cmd === "down" || cmd === "left" || cmd === "right") {
                    e.preventDefault();
                    navModal(cmd, document.activeElement)
                }
            }, true);
            document.addEventListener("keydown", function(e) {
                var c = e.keyCode;
                if (c !== 27 && c !== 461 && c !== 10009) {
                    return
                }
                if (!document.body.contains(view) || !view.__dcIsOpen()) {
                    return
                }
                e.preventDefault();
                e.stopPropagation();
                if (trailerOverlay.classList.contains("open")) {
                    closeTrailer()
                } else {
                    closeModal()
                }
            }, true);
            window.addEventListener("hashchange", function() {
                if (view.__dcIsOpen()) {
                    view.__dcClose()
                }
            });
            return
        }
        if (window.__dcHeaderSync) {
            window.removeEventListener("hashchange", window.__dcHeaderSync)
        }
        window.__dcHeaderSync = syncHeader;
        window.addEventListener("hashchange", syncHeader);
        var topRoot = view.querySelector(".dcRoot");
        var topBtn = document.createElement("button");
        topBtn.type = "button";
        topBtn.className = "dcToTop";
        topBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path transform="rotate(-90 12 12)" d="M9.3 6.3a1 1 0 0 0 0 1.4l4.3 4.3-4.3 4.3a1 1 0 1 0 1.4 1.4l5-5a1 1 0 0 0 0-1.4l-5-5a1 1 0 0 0-1.4 0z"/></svg>';
        topBtn.title = topBtn.ariaLabel = text("Naar boven", "Back to top", "Nach oben", "Til toppen");
        var topCss = document.createElement("style");
        topCss.textContent = ".dcRoot.dcGutter{padding-right:3.8em!important}.dcToTop{position:fixed;right:.7em;top:50%;transform:translateY(-50%);width:2.6em;height:6em;padding:0;border-radius:100em;border:0;background:#fff;color:#000;cursor:pointer;display:none;align-items:center;justify-content:center;z-index:50;box-shadow:0 .2em .8em rgba(0,0,0,.5);opacity:.92}" + ".dcToTop svg{width:2.2em;height:2.2em;fill:currentColor}.dcToTop.show{display:flex}body:not(.dcDiscoverActive) .dcToTop{display:none!important}.dcToTop:hover,.dcToTop:focus{outline:0;box-shadow:0 0 0 3px var(--dc-accent,#ffb400),0 .2em .8em rgba(0,0,0,.5)}" + ".dcGrid{display:grid;grid-template-columns:repeat(auto-fill,170px);justify-content:space-between}.dcGrid>.dcMsg{grid-column:1/-1}@media (max-width:600px){.dcGrid{grid-template-columns:repeat(auto-fill,130px)}}" + "@media (max-width:800px){.dcRoot.dcGutter{padding-right:3.2em!important}.dcToTop{right:.3em;width:2.4em;height:5em}}";
        view.appendChild(topCss);
        view.appendChild(topBtn);

        function toTop() {
            if (topRoot) {
                try {
                    topRoot.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    })
                } catch (e) {
                    topRoot.scrollTop = 0
                }
            }
            try {
                window.scrollTo(0, 0)
            } catch (e) {}
            if (isTvClient) {
                setTimeout(focusFirstItem, 350)
            }
        }
        topBtn.addEventListener("click", toTop);
        if (topRoot) {
            topRoot.addEventListener("scroll", function() {
                topBtn.classList.toggle("show", topRoot.scrollTop > 600)
            }, {
                passive: true
            })
        }

        function syncGutter() {
            if (topRoot) {
                topRoot.classList.toggle("dcGutter", !!homeShown)
            }
        }
        if (window.MutationObserver) {
            new MutationObserver(syncGutter).observe(content, {
                childList: true
            })
        }
        syncGutter();

        function onHeaderBack(e) {
            var b = e.target && e.target.closest && e.target.closest('.headerBackButton, .headerBackButton-back, [data-action="back"]');
            if (!b || !b.closest(".skinHeader")) {
                return
            }
            if (!onDiscoverRoute() || !document.body.contains(view) || !isShown(view.querySelector(".dcRoot"))) {
                return
            }
            if (goBack(true)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation()
            }
        }
        view.addEventListener("viewshow", function() {
            syncHeader();
            document.addEventListener("command", onCommand, true);
            document.addEventListener("click", onHeaderBack, true)
        });
        view.addEventListener("viewhide", function() {
            document.body.classList.remove("dcDiscoverActive");
            document.removeEventListener("command", onCommand, true);
            document.removeEventListener("click", onHeaderBack, true)
        });

        function takePending() {
            try {
                var raw = sessionStorage.getItem("dcOpenNext");
                if (!raw) {
                    return null
                }
                var p = JSON.parse(raw);
                if (!p || Date.now() - (p.at || 0) > 3e4) {
                    sessionStorage.removeItem("dcOpenNext");
                    return null
                }
                if (view.__dcTook === p.at) {
                    return null
                }
                view.__dcTook = p.at;
                setTimeout(function() {
                    try {
                        var cur = sessionStorage.getItem("dcOpenNext");
                        if (cur === raw) {
                            sessionStorage.removeItem("dcOpenNext")
                        }
                    } catch (e) {}
                }, 1e4);
                return p
            } catch (e) {
                return null
            }
        }

        function openFromLink() {
            var pend = takePending();
            if (pend && pend.kind === "person" && pend.id) {
                try {
                    history.replaceState(null, "", window.location.href.replace(/&openPerson=\d+(&openName=[^&]*)?/, ""))
                } catch (e) {}
                openPerson(parseInt(pend.id, 10), pend.name || "", true);
                return
            }
            if (pend && pend.kind === "title" && pend.id) {
                api("GET", "Discover/Title", {
                    Type: pend.type,
                    TmdbId: parseInt(pend.id, 10)
                }).then(function(r) {
                    if (r && r.Found && r.Item) {
                        items[key(r.Item)] = r.Item;
                        openItem(r.Item)
                    }
                }, function() {});
                try {
                    history.replaceState(null, "", window.location.href.replace(/&openType=[^&]*&openId=\d+/, "").replace(/&openPerson=\d+(&openName=[^&]*)?/, ""))
                } catch (e) {}
                return
            }
            var pm = /[?&]openPerson=(\d+)(?:&openName=([^&]*))?/.exec(window.location.hash || "");
            if (pm) {
                try {
                    history.replaceState(null, "", window.location.href.replace(/&openPerson=\d+(&openName=[^&]*)?/, ""))
                } catch (e) {}
                var nm = "";
                try {
                    nm = decodeURIComponent(pm[2] || "")
                } catch (e) {}
                openPerson(parseInt(pm[1], 10), nm, true);
                return
            }
            var m = /[?&]openType=(movie|tv)&openId=(\d+)/.exec(window.location.hash || "");
            if (!m) {
                return
            }
            try {
                history.replaceState(null, "", window.location.href.replace(/&openType=[^&]*&openId=\d+/, ""))
            } catch (e) {}
            api("GET", "Discover/Title", {
                Type: m[1],
                TmdbId: parseInt(m[2], 10)
            }).then(function(r) {
                if (!r || !r.Found || !r.Item) {
                    showToast(text("Titel niet gevonden.", "Title not found.", "Titel nicht gefunden."), true);
                    return
                }
                items[key(r.Item)] = r.Item;
                openItem(r.Item)
            }, function() {
                showToast(text("Titel laden mislukt.", "Loading title failed.", "Titel konnte nicht geladen werden."), true)
            })
        }
        view.addEventListener("viewshow", function() {
            if (!loaded) {
                loadHome()
            } else {
                scheduleQueue(0);
                loadMyRequests();
                loadExtras()
            }
            openFromLink()
        });
        view.addEventListener("viewhide", function() {
            clearTimeout(queueTimer);
            queueTimer = null
        })
    }
});
