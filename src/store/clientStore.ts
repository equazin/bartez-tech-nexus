import { Client } from "@/models/client";

const CLIENT_KEY = "b2b_clients";

export function getStoredClients(): Client[] {
  const raw = localStorage.getItem(CLIENT_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveClients(clients: Client[]) {
  localStorage.setItem(CLIENT_KEY, JSON.stringify(clients));
}

export function addClient(client: Client) {
  const clients = getStoredClients();
  clients.push(client);
  saveClients(clients);
}
