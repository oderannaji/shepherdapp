import { readConnection } from "@/lib/connection-config";
export const connection = readConnection(import.meta.env);
