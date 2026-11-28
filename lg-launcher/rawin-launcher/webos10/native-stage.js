// Stage the existing QML host as system Home. The runner supplied by the TV
// owns SAM registration; the same Panel.qml still draws the overlay.
'use strict';
var fs = require('fs'), path = require('path');
function stage(app, target) {
    if (!fs.existsSync(target)) fs.mkdirSync(target);
    var info = JSON.parse(fs.readFileSync(path.join(app, 'appinfo.json'), 'utf8'));
    info.id = 'com.webos.app.home';
    info.title = 'Home';
    info.type = 'qml';
    info.nativeLifeCycleInterfaceVersion = 2;
    info.appCategory = ['home'];
    info.defaultWindowType = 'overlay';
    // The Home identity must stay out of the launch point list: SAM refuses to
    // block (and so to reread) an app that has a tile, and LG Home could not
    // be given back. The app tile belongs to org.rawin.launcher only.
    info.visible = false;
    info.closeOnBackground = false;
    fs.writeFileSync(path.join(target, 'appinfo.json'), JSON.stringify(info, null, 2));
    ['main.qml', 'Panel.qml', 'FavouriteStore.qml', 'Strings.js', 'Themes.js', 'About.js', 'DeviceIcons.js', 'DeviceIcon.qml', 'input-icons', 'fonts', 'icon.png'].forEach(function (name) {
        var dest = path.join(target, name);
        if (existsLink(dest)) fs.unlinkSync(dest);
        fs.symlinkSync(path.join(app, name), dest);
    });
    var config = fs.readFileSync(path.join(app, 'Config.js'), 'utf8');
    config = config.replace(/^var exitTarget = .*$/m, 'var exitTarget = true;');
    config = config.replace(/^var platform = .*$/m, 'var platform = \"native Home\";');
    config += '\nvar nativeHome = true;\n';
    fs.writeFileSync(path.join(target, 'Config.js'), config);
}
function existsLink(p) { try { fs.lstatSync(p); return true; } catch (e) { if (e.code !== 'ENOENT') throw e; return false; } }
if (require.main === module) stage(process.argv[2], process.argv[3]);
module.exports = stage;
