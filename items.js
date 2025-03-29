/**
 * A module that defines two classes, `StatsItem` and `PrefsItem`, which are 
 * subclasses of `PopupMenu.PopupBaseMenuItem`
 * These classes are used to create menu items with labels and values.
 *
 */

import Clutter from "gi://Clutter";
import GObject from "gi://GObject";
import St from "gi://St";

import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

/**
 * An enumeration representing the context of an item.
 */
export const ItemContext = {
  SUCCESS: 0,
  ERROR: 1,
  PREF: 2,
};

export const StatsItem = GObject.registerClass(
  {
    GTypeName: "StatsItem",
  },
  class StatsItem extends PopupMenu.PopupBaseMenuItem {
    /**
     * Creates a new instance of `StatsItem`.
     * @param {string} statsName - The name of the statistics item.
     */
    _init(statsName) {
      super._init();

      /**
       * The label for the name of the statistics item.
       * @type {St.Label}
       * @private
       */
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
      this.actor.add_child(this._valueLabel);

      this.itemContext = ItemContext.SUCCESS;
    }

    get text() {
      return this._valueLabel.text;
    }

    set text(value) {
      this._valueLabel.text = value;
    }
  }
);

/**
 * A class representing a preferences item.
 * @extends StatsItem
 */
export const PrefsItem = GObject.registerClass(
  {
    GTypeName: "PrefsItem",
  },
  class PrefsItem extends StatsItem {
    /**
     * Creates a new instance of `PrefsItem`.
     */
    _init() {
      super._init(_("Settings"));
      this._valueLabel.set_style_class_name("ver-value");
      this.itemContext = ItemContext.PREF;
    }
  }
);
