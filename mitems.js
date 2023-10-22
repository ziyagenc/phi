const { Clutter, GObject, St } = imports.gi;

var MultiStatItem = GObject.registerClass(
  { GTypeName: "MultiStatItem" },
  class MultiStatItem extends St.BoxLayout {
    _init(label) {
      super._init({
        style_class: "menu-item",
      });

      this._label1 = new St.Label({
        text: label,
        x_align: Clutter.ActorAlign.START,
        x_expand: true,
        style_class: "stat-name",
      });
      this._label2 = new St.Label({
        style_class: "stat-value",
      });
      this._label3 = new St.Label({
        style_class: "stat-value",
      });

      this.add_child(this._label1);
      this.add_child(this._label2);
      this.add_child(this._label3);
    }

    /**
     * @param {string} value
     */
    set text1(value) {
      this._label2.text = value;
    }

    /**
     * @param {string} value
     */
    set text2(value) {
      this._label3.text = value;
    }
  }
);

var HeaderItem = GObject.registerClass(
  { GTypeName: "HeaderItem" },
  class HeaderItem extends St.BoxLayout {
    _init(name1, name2) {
      super._init({
        style_class: "menu-item",
      });

      this._label = new St.Label({
        text: _("Pi-hole Status"),
        x_align: Clutter.ActorAlign.START,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: "stat-name",
      });

      this._box1 = new St.BoxLayout({
        style_class: "stat-value",
      });

      this._box2 = new St.BoxLayout({
        style_class: "stat-value",
      });

      this._button1 = new St.Button({
        label: name1,
        style_class: "phi-button disabled",
        x_align: Clutter.ActorAlign.END,
        x_expand: true,
      });

      this._button2 = new St.Button({
        label: name2,
        style_class: "phi-button disabled",
        x_align: Clutter.ActorAlign.END,
        x_expand: true,
      });

      this._box1.add_child(this._button1);
      this._box2.add_child(this._button2);

      this.state1 = false;
      this.state2 = false;

      this.add_child(this._label);
      this.add_child(this._box1);
      this.add_child(this._box2);
    }
  }
);

var TailItem = GObject.registerClass(
  { GTypeName: "TailItem" },
  class TailItem extends St.BoxLayout {
    _init() {
      super._init({
        style_class: "menu-item",
      });

      this._button = new St.Button({
        label: _("Settings"),
        x_align: Clutter.ActorAlign.START,
        x_expand: true,
        style_class: "phi-button settings",
      });

      this._label1 = new St.Label({
        style_class: "stat-value ver-value",
        y_align: Clutter.ActorAlign.CENTER,
      });

      this._label2 = new St.Label({
        style_class: "stat-value ver-value",
        y_align: Clutter.ActorAlign.CENTER,
      });

      this.add_child(this._button);
      this.add_child(this._label1);
      this.add_child(this._label2);
    }

    /**
     * @param {string} value
     */
    set text1(value) {
      this._label1.text = value;
    }

    /**
     * @param {string} value
     */
    set text2(value) {
      this._label2.text = value;
    }
  }
);

var Line = GObject.registerClass(
  { GTypeName: "Line" },
  class Line extends St.BoxLayout {
    _init() {
      super._init({
        style_class: "menu-item pihole-line",
      });
    }
  }
);
