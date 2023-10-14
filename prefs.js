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

  const url_entry = builder.get_object("url_entry");
  const token_entry = builder.get_object("token_entry");
  const interval_spin = builder.get_object("interval_spin");
  const hideui_switch = builder.get_object("hideui_switch");
  const restrict_expander = builder.get_object("restrict_expander");
  const networks_entry = builder.get_object("networks_entry");
  const reset_button = builder.get_object("reset_button");

  const settings = ExtensionUtils.getSettings();
  settings.bind("url", url_entry, "text", Gio.SettingsBindFlags.DEFAULT);
  settings.bind("token", token_entry, "text", Gio.SettingsBindFlags.DEFAULT);
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

  if (restrict_expander.enable_expansion) window.default_height = 625;
}

function resetSettings() {
  const settings = ExtensionUtils.getSettings();
  settings.reset("url");
  settings.reset("token");
  settings.reset("interval");
  settings.reset("hideui");
  settings.reset("restrict");
  settings.reset("networks");
}
