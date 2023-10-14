const { Clutter, GObject, St } = imports.gi;
const PopupMenu = imports.ui.popupMenu;

var ItemContext = {
  SUCCESS: 0,
  ERROR: 1,
  PREF: 2,
};

var StatsItem = GObject.registerClass(
  { GTypeName: "StatsItem" },
  class StatsItem extends PopupMenu.PopupBaseMenuItem {
    _init(statsName) {
      super._init();

      this._nameLabel = new St.Label({
        text: statsName,
        x_align: Clutter.ActorAlign.START,
        x_expand: true,
        style_class: "stat-name",
      });

      this._valueLabel = new St.Label({
        text: "",
      });

      this.actor.add_child(this._nameLabel);
      this.actor.add(this._valueLabel);

      this.context = ItemContext.SUCCESS;
    }

    get text() {
      return this._valueLabel.text;
    }

    /**
     * @param {string} value
     */
    set text(value) {
      this._valueLabel.text = value;
    }
  }
);

var PrefsItem = GObject.registerClass(
  { GTypeName: "PrefsItem" },
  class PrefsItem extends StatsItem {
    _init() {
      super._init(_("Settings"));
      this._valueLabel.set_style_class_name("pref-value");
      this.context = ItemContext.PREF;
    }
  }
);
