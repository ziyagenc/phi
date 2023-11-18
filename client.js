import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Soup from "gi://Soup";

Gio._promisify(Soup.Session.prototype, "send_async", "send_finish");
Gio._promisify(Gio.OutputStream.prototype, "splice_async", "splice_finish");

export const PiholeClient = GObject.registerClass(
  {
    GTypeName: "PiholeClient",
  },
  class PiholeClient extends GObject.Object {
    constructor(url, token) {
      super();
      this._authUrl = url + "?auth=" + token;
      this._summaryUrl = this._authUrl + "&summary";
      this._versionsUrl = this._authUrl + "&versions";

      this._session = new Soup.Session();
    }

    async _readAsString(input_stream) {
      const output_stream = Gio.MemoryOutputStream.new_resizable();

      await output_stream.splice_async(
        input_stream,
        Gio.OutputStreamSpliceFlags.CLOSE_TARGET |
          Gio.OutputStreamSpliceFlags.CLOSE_SOURCE,
        GLib.PRIORITY_DEFAULT,
        null
      );

      const bytes = output_stream.steal_as_bytes();
      const text_decoder = new TextDecoder("utf-8");
      return text_decoder.decode(bytes.toArray().buffer);
    }

    async _fetchUrl(url) {
      const message = Soup.Message.new("GET", url);
      const input_stream = await this._session.send_async(
        message,
        GLib.PRIORITY_DEFAULT,
        null
      );

      if (message.status_code !== Soup.Status.OK) {
        this._handleError(ClientError.HTTP_NOT_OK);
        return;
      }

      const data = await this._readAsString(input_stream);
      return JSON.parse(data);
    }

    async fetchSummary() {
      const json = await this._fetchUrl(this._summaryUrl);
      return json;
    }

    async fetchVersion() {
      const json = await this._fetchUrl(this._versionsUrl);
      return json;
    }

    togglePihole(state) {
      const toggleUrl = state
        ? this._authUrl + "&enable"
        : this._authUrl + "&disable";

      this._fetchUrl(toggleUrl).catch();
    }

    destroy() {
      this._session = null;
    }
  }
);
