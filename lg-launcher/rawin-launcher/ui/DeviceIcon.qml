import QtQuick 2.6

// Preserve the mask's detail through focus scaling and the TV's output scale.
// A small tinted texture with mipmaps avoids aliasing when shrinking the mask;
// drawing straight into a 32/48px Canvas loses those edges before compositing.
Item {
    id: glyph
    property string iconId: "hdmi"
    property color ink: "white"
    Canvas {
        id: mask
        width: 128; height: 128
        scale: glyph.width / width; transformOrigin: Item.TopLeft
        smooth: true; antialiasing: true
        layer.enabled: true; layer.smooth: true; layer.mipmap: true
        property url imageUrl: Qt.resolvedUrl("input-icons/" + glyph.iconId + ".png")
        property url loadedUrl: ""
        function loadMask() {
            if (loadedUrl.toString() !== "") unloadImage(loadedUrl);
            loadedUrl = imageUrl;
            loadImage(imageUrl);
            requestPaint();
        }
        Component.onCompleted: loadMask()
        onImageUrlChanged: loadMask()
        onImageLoaded: requestPaint()
        Connections { target: glyph; onInkChanged: mask.requestPaint() }
        onPaint: {
            var c = getContext("2d");
            c.reset();
            if (!isImageLoaded(imageUrl)) return;
            c.drawImage(imageUrl, 0, 0, width, height);
            c.globalCompositeOperation = "source-in";
            c.fillStyle = glyph.ink;
            c.fillRect(0, 0, width, height);
        }
    }
}
