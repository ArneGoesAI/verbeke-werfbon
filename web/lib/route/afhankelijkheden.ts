// De afhankelijkheden van POST /api/verwerk in de app: de sessie uit de cookies en de dienstclient. Alleen op de
// server; de code zelf staat in afhankelijkheden-kern.ts.

import "server-only";

import { dienstClient } from "../supabase/dienst";
import { serverClient } from "../supabase/server";
import { maakAfhankelijkheden } from "./afhankelijkheden-kern";

export const echteAfhankelijkheden = maakAfhankelijkheden(serverClient, dienstClient);
