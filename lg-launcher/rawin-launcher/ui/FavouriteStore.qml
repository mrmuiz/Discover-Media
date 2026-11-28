import QtQuick 2.6
import QtQuick.LocalStorage 2.0 as Sql

// Favourites edited on the TV. Kept in a separate file so that a missing
// LocalStorage module only disables saving, never the Home panel itself.
Item {
    visible: false
    function db() {
        var d = Sql.LocalStorage.openDatabaseSync("rawinLauncher", "1.0", "rawin-launcher", 16384);
        d.transaction(function(tx) { tx.executeSql("CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT)"); });
        return d;
    }
    function read(d, key) {
        var ids = null;
        d.readTransaction(function(tx) {
            var r = tx.executeSql("SELECT v FROM kv WHERE k = ?", [key]);
            if (r.rows.length) ids = JSON.parse(r.rows.item(0).v);
        });
        return ids;
    }
    // Returns the saved value (favourites: a list of app ids; settings: an
    // object), or null when nothing was saved yet. key: storage slot.
    function load(key) {
        return read(db(), key || "favourites");
    }
    function save(ids, key) {
        db().transaction(function(tx) {
            tx.executeSql("INSERT OR REPLACE INTO kv VALUES(?, ?)", [key || "favourites", JSON.stringify(ids)]);
        });
    }
}
