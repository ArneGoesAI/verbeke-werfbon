// De dienstclient (secret key, passeert RLS) voor de app. "server-only" laat de build falen als dit bestand ooit in
// een clientcomponent belandt, zodat de secret key nooit in de browser komt.

import "server-only";

export { maakDienstClient as dienstClient } from "./dienst-kern";
