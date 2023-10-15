const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const { PiholeIndicator } = Me.imports.indicator;

class PiholeExtension {
  enable() {
    console.log(`Enabling ${Me.metadata.name}.`);

    this._indicator = new PiholeIndicator();
  }

  disable() {
    console.log(`Disabling ${Me.metadata.name}.`);

    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}

function init() {
  return new PiholeExtension();
}
