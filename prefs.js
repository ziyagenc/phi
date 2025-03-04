import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk?version=4.0";

import {
  ExtensionPreferences,
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import * as DBus from "./dbus.js";

Gio._promisify(Adw.MessageDialog.prototype, "choose", "choose_finish");
Gio._promisify(Gtk.UriLauncher.prototype, "launch", "launch_finish");

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
    settings.reset("version1");
    settings.reset("url2");
    settings.reset("token2");
    settings.reset("instance2");
    settings.reset("version2");
    settings.reset("multimode");
    settings.reset("interval");
    settings.reset("hideui");
    settings.reset("check-network");
    settings.reset("network");
    settings.reset("check-new-version");
  }

  fillPreferencesWindow(window) {
    const builder = new Gtk.Builder();
    builder.set_translation_domain(this.metadata["gettext-domain"]);
    builder.add_from_file(this.path + "/ui/piholelist.ui");
    builder.add_from_file(this.path + "/ui/behavior.ui");
    builder.add_from_file(this.path + "/ui/about.ui");

    const url_entry1 = builder.get_object("url_entry1");
    const token_entry1 = builder.get_object("token_entry1");
    const instance_name1 = builder.get_object("instance_name1");
    const version_row1 = builder.get_object("version_row1");
    const url_entry2 = builder.get_object("url_entry2");
    const token_entry2 = builder.get_object("token_entry2");
    const instance_name2 = builder.get_object("instance_name2");
    const version_row2 = builder.get_object("version_row2");
    const show_sensor_data_switch = builder.get_object("sensor_switch");
    const multimode_switch = builder.get_object("multimode_switch");
    const interval_spin = builder.get_object("interval_spin");
    const hideui_switch = builder.get_object("hideui_switch");
    const check_network_switch = builder.get_object("check_network_switch");
    const network_entry = builder.get_object("network_entry");
    const reset_button = builder.get_object("reset_button");
    const phi_logo = builder.get_object("phi_logo");
    const action_issue = builder.get_object("action_issue");
    const action_whats_new = builder.get_object("action_whats_new");
    const action_changelog = builder.get_object("action_changelog");
    const action_legal = builder.get_object("action_legal");
    const button_go_back = builder.get_object("button_go_back");
    const button_go_back2 = builder.get_object("button_go_back2");
    const page_whats_new = builder.get_object("page_whats_new");
    const page_legal = builder.get_object("page_legal");
    const check_new_version_switch = builder.get_object(
      "check_new_version_switch"
    );

    phi_logo.file = this.path + "/icons/phi-symbolic.svg";

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
      "version1",
      version_row1,
      "selected",
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
      "version2",
      version_row2,
      "selected",
      Gio.SettingsBindFlags.DEFAULT
    );
    window._settings.bind(
      "show-sensor-data",
      show_sensor_data_switch,
      "active",
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
    window._settings.bind(
      "check-new-version",
      check_new_version_switch,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );

    version_row1.connect("notify::selected-item", () => {
      const selected_item = version_row1.selected_item.get_string();
      if (selected_item === "6") {
        token_entry1.set_title("Password");
      } else {
        token_entry1.set_title("API Token");
      }
    });

    version_row2.connect("notify::selected-item", () => {
      const selected_item = version_row2.selected_item.get_string();
      if (selected_item === "6") {
        token_entry2.set_title("Password");
      } else {
        token_entry2.set_title("API Token");
      }
    });

    check_network_switch.connect("notify::active", () => {
      if (check_network_switch.active) {
        this.setNetworkList(network_entry).catch();
      }
    });

    reset_button.connect("clicked", () => {
      this.confirmReset(window);
    });

    action_issue.connect("activated", () => {
      new Gtk.UriLauncher({ uri: "https://github.com/ziyagenc/phi/issues" })
        .launch(window, null)
        .catch();
    });

    action_whats_new.connect("activated", () => {
      window.present_subpage(page_whats_new);
    });

    action_changelog.connect("activated", () => {
      new Gtk.UriLauncher({
        uri: "https://github.com/ziyagenc/phi/blob/main/CHANGELOG.md",
      })
        .launch(window, null)
        .catch();
    });

    action_legal.connect("activated", () => {
      window.present_subpage(page_legal);
    });

    button_go_back.connect("clicked", () => {
      window.close_subpage();
    });

    button_go_back2.connect("clicked", () => {
      window.close_subpage();
    });

    window.add(builder.get_object("piholelist"));
    window.add(builder.get_object("behavior"));
    window.add(builder.get_object("about"));
  }
}
