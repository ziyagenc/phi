const { Gio, GObject } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const DBus = Me.imports.dbus;
const { Pihole } = Me.imports.pihole;

var PiholeIndicator = GObject.registerClass(
  class PiholeIndicator extends GObject.Object {
    constructor() {
      super();

      this._settings = ExtensionUtils.getSettings();
      this._network_monitor = Gio.NetworkMonitor.get_default();
      this._pihole = null;

      this._configure();
      this._setHandlers();
      this._start().catch();
    }

    _configure() {
      this._hideUi = this._settings.get_boolean("hideui");
      this._restrict = this._settings.get_boolean("restrict");
      this._networks = this._settings.get_string("networks");
    }

    _setHandlers() {
      this._networkHandlerId = this._network_monitor.connect(
        "network-changed",
        () => {
          this._start().catch();
        }
      );

      this._settingsHandlerId = this._settings.connect("changed", () => {
        this._configure();
        this._start().catch();
      });
    }

    async _start() {
      if (this._pihole) {
        this._pihole.destroy();
        this._pihole = null;
      }

      if (this._network_monitor.network_available) {
        if (this._restrict && this._hideUi) {
          const currentNetworkId = await DBus.getNetworkIdAsync();

          this._pihole = this._networks.split(";").includes(currentNetworkId)
            ? new Pihole("start")
            : null;
        } else if (this._restrict) {
          const currentNetworkId = await DBus.getNetworkIdAsync();

          this._pihole = this._networks.split(";").includes(currentNetworkId)
            ? new Pihole("start")
            : new Pihole("unknown_network");
        } else {
          this._pihole = new Pihole("start");
        }
      } else {
        if (!this._hideUi) this._pihole = new Pihole("no_network");
      }
    }

    destroy() {
      this._settings.disconnect(this._settingsHandlerId);
      this._settings = null;

      this._network_monitor.disconnect(this._networkHandlerId);

      if (this._pihole) {
        this._pihole.destroy();
        this._pihole = null;
      }
    }
  }
);
