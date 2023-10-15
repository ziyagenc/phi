import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

import {
  ExtensionPreferences,
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import * as DBus from "./dbus.js";

Gio._promisify(Adw.MessageDialog.prototype, "choose", "choose_finish");

export default class PiholeIndicatorPrefs extends ExtensionPreferences {
  async setNetworkList(networks_entry) {
    networks_entry.text = await DBus.getNetworkIdAsync();
  }

  async confirmReset(window) {
    const dialog = new Adw.MessageDialog({
      heading: _("Reset Settings"),
      body: _("Do you want to remove all settings?"),
      close_response: "cancel",
      modal: true,
      transient_for: window,
    });

    dialog.add_response("cancel", _("Cancel"));
    dialog.add_response("reset", _("Reset"));

    dialog.set_response_appearance("reset", Adw.ResponseAppearance.DESTRUCTIVE);

    const response = await dialog.choose(null);
    if (response === "reset") this.resetSettings(window._settings);
  }

  resetSettings(settings) {
    settings.reset("url");
    settings.reset("token");
    settings.reset("interval");
    settings.reset("hideui");
    settings.reset("restrict");
    settings.reset("networks");
  }

  fillPreferencesWindow(window) {
    const builder = new Gtk.Builder();
    builder.set_translation_domain(this.metadata["gettext-domain"]);
    builder.add_from_file(this.path + "/prefs.ui");

    const url_entry = builder.get_object("url_entry");
    const token_entry = builder.get_object("token_entry");
    const interval_spin = builder.get_object("interval_spin");
    const hideui_switch = builder.get_object("hideui_switch");
    const restrict_expander = builder.get_object("restrict_expander");
    const networks_entry = builder.get_object("networks_entry");
    const reset_button = builder.get_object("reset_button");

    window._settings = this.getSettings();
    window._settings.bind(
      "url",
      url_entry,
      "text",
      Gio.SettingsBindFlags.DEFAULT
    );
    window._settings.bind(
      "token",
      token_entry,
      "text",
      Gio.SettingsBindFlags.DEFAULT
    );
    window._settings.bind(
      "interval",
      interval_spin,
      "value",
      Gio.SettingsBindFlags.DEFAULT
    );
    window._settings.bind(
      "hideui",
      hideui_switch,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );
    window._settings.bind(
      "restrict",
      restrict_expander,
      "enable_expansion",
      Gio.SettingsBindFlags.DEFAULT
    );
    window._settings.bind(
      "networks",
      networks_entry,
      "text",
      Gio.SettingsBindFlags.DEFAULT
    );

    restrict_expander.connect("notify::enable-expansion", () => {
      if (restrict_expander.enable_expansion) {
        this.setNetworkList(networks_entry).catch(console.error);
        window.default_height = 625;
      } else {
        window.default_height = 600;
      }
    });

    reset_button.connect("clicked", () => {
      this.confirmReset(window);
    });

    window.add(builder.get_object("preferences"));

    if (restrict_expander.enable_expansion) window.default_height = 625;
  }
}
