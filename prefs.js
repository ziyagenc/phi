const { Adw, Gio, Gtk } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const _ = ExtensionUtils.gettext;
const DBus = Me.imports.dbus;

Gio._promisify(Adw.MessageDialog.prototype, "choose", "choose_finish");

async function setNetworkList(networks_entry) {
  networks_entry.text = await DBus.getNetworkIdAsync();
}

async function confirmReset(window) {
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
  if (response === "reset") resetSettings();
}

function init() {
  ExtensionUtils.initTranslations();
}

function fillPreferencesWindow(window) {
  const builder = new Gtk.Builder();
  builder.set_translation_domain(Me.metadata["gettext-domain"]);
  builder.add_from_file(Me.path + "/prefs.ui");

  const url_entry1 = builder.get_object("url_entry1");
  const token_entry1 = builder.get_object("token_entry1");
  const instance_name1 = builder.get_object("instance_name1");
  const url_entry2 = builder.get_object("url_entry2");
  const token_entry2 = builder.get_object("token_entry2");
  const instance_name2 = builder.get_object("instance_name2");
  const multimode_switch = builder.get_object("multimode_switch");
  const interval_spin = builder.get_object("interval_spin");
  const hideui_switch = builder.get_object("hideui_switch");
  const restrict_expander = builder.get_object("restrict_expander");
  const networks_entry = builder.get_object("networks_entry");
  const reset_button = builder.get_object("reset_button");

  const settings = ExtensionUtils.getSettings();
  settings.bind("url1", url_entry1, "text", Gio.SettingsBindFlags.DEFAULT);
  settings.bind("token1", token_entry1, "text", Gio.SettingsBindFlags.DEFAULT);
  settings.bind(
    "instance1",
    instance_name1,
    "text",
    Gio.SettingsBindFlags.DEFAULT
  );
  settings.bind("url2", url_entry2, "text", Gio.SettingsBindFlags.DEFAULT);
  settings.bind("token2", token_entry2, "text", Gio.SettingsBindFlags.DEFAULT);
  settings.bind(
    "instance2",
    instance_name2,
    "text",
    Gio.SettingsBindFlags.DEFAULT
  );
  settings.bind(
    "multimode",
    multimode_switch,
    "active",
    Gio.SettingsBindFlags.DEFAULT
  );
  settings.bind(
    "interval",
    interval_spin,
    "value",
    Gio.SettingsBindFlags.DEFAULT
  );
  settings.bind(
    "hideui",
    hideui_switch,
    "active",
    Gio.SettingsBindFlags.DEFAULT
  );
  settings.bind(
    "restrict",
    restrict_expander,
    "enable_expansion",
    Gio.SettingsBindFlags.DEFAULT
  );
  settings.bind(
    "networks",
    networks_entry,
    "text",
    Gio.SettingsBindFlags.DEFAULT
  );

  restrict_expander.connect("notify::enable-expansion", () => {
    if (restrict_expander.enable_expansion) {
      setNetworkList(networks_entry).catch(console.error);
    }
  });

  reset_button.connect("clicked", () => {
    confirmReset(window).catch(console.error);
  });

  window.add(builder.get_object("preferences"));
}

function resetSettings() {
  const settings = ExtensionUtils.getSettings();
  settings.reset("url1");
  settings.reset("token1");
  settings.reset("instance1");
  settings.reset("url2");
  settings.reset("token2");
  settings.reset("multimode");
  settings.reset("instance2");
  settings.reset("interval");
  settings.reset("hideui");
  settings.reset("restrict");
  settings.reset("networks");
}
