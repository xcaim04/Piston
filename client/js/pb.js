// Cliente único de PocketBase. Cambiar la URL si el servidor no corre en local.
import PocketBase from "https://cdn.jsdelivr.net/npm/pocketbase@0.28.1/dist/pocketbase.es.mjs";

export const pb = new PocketBase("http://127.0.0.1:8090");
// Las pantallas lanzan consultas en paralelo a la misma colección; con la
// cancelación automática del SDK, la segunda anularía a la primera.
pb.autoCancellation(false);
