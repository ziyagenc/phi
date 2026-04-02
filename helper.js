import Gio from "gi://Gio";
import GLib from "gi://GLib";

Gio._promisify(Gio.OutputStream.prototype, "splice_async", "splice_finish");

const decoder = new TextDecoder();

export async function readAsString(input_stream) {
  const output_stream = Gio.MemoryOutputStream.new_resizable();

  await output_stream.splice_async(
    input_stream,
    Gio.OutputStreamSpliceFlags.CLOSE_TARGET |
      Gio.OutputStreamSpliceFlags.CLOSE_SOURCE,
    GLib.PRIORITY_DEFAULT,
    null
  );

  const bytes = output_stream.steal_as_bytes();
  return decoder.decode(bytes.toArray());
}
