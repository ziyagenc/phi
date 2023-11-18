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
      body: _("Do you want to reset all settings?"),
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
    settings.reset("url1");
    settings.reset("token1");
    settings.reset("instance1");
    settings.reset("url2");
    settings.reset("token2");
    settings.reset("instance2");
    settings.reset("multimode");
    settings.reset("interval");
    settings.reset("hideui");
    settings.reset("check-network");
    settings.reset("network");
  }

  fillPreferencesWindow(window) {
    const builder = new Gtk.Builder();
    builder.set_translation_domain(this.metadata["gettext-domain"]);
    builder.add_from_file(this.path + "/ui/piholelist.ui");
    builder.add_from_file(this.path + "/ui/behavior.ui");

    const url_entry1 = builder.get_object("url_entry1");
    const token_entry1 = builder.get_object("token_entry1");
    const instance_name1 = builder.get_object("instance_name1");
    const url_entry2 = builder.get_object("url_entry2");
    const token_entry2 = builder.get_object("token_entry2");
    const instance_name2 = builder.get_object("instance_name2");
    const multimode_switch = builder.get_object("multimode_switch");
    const interval_spin = builder.get_object("interval_spin");
    const hideui_switch = builder.get_object("hideui_switch");
    const check_network_switch = builder.get_object("check_network_switch");
    const network_entry = builder.get_object("network_entry");
    const reset_button = builder.get_object("reset_button");

    window._settings = this.getSettings();
    window._settings.bind(
      "url1",
      url_entry1,
      "text",
      Gio.SettingsBindFlags.DEFAULT
    );
    window._settings.bind(
      "token1",
      token_entry1,
      "text",
      Gio.SettingsBindFlags.DEFAULT
    );
    window._settings.bind(
      "instance1",
      instance_name1,
      "text",
      Gio.SettingsBindFlags.DEFAULT
    );
    window._settings.bind(
      "url2",
      url_entry2,
      "text",
      Gio.SettingsBindFlags.DEFAULT
    );
    window._settings.bind(
      "token2",
      token_entry2,
      "text",
      Gio.SettingsBindFlags.DEFAULT
    );
    window._settings.bind(
      "instance2",
      instance_name2,
      "text",
      Gio.SettingsBindFlags.DEFAULT
    );
    window._settings.bind(
      "multimode",
      multimode_switch,
      "active",
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
      "check-network",
      check_network_switch,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );
    window._settings.bind(
      "network",
      network_entry,
      "text",
      Gio.SettingsBindFlags.DEFAULT
    );

    check_network_switch.connect("notify::active", () => {
      if (check_network_switch.active) {
        this.setNetworkList(network_entry).catch(console.error);
      }
    });

    reset_button.connect("clicked", () => {
      this.confirmReset(window);
    });

    window.add(builder.get_object("piholelist"));
    window.add(builder.get_object("behavior"));
  }
}
