import type { DashboardPayload } from "../../shared/types.js";
import { buildDashboardFromPeople } from "./appreciation.js";
import { loadDashboardPayload, loadPeopleConfig, saveDashboardPayload } from "./storage.js";

export async function getDashboard(forceRefresh = false): Promise<DashboardPayload> {
  const cached = await loadDashboardPayload();

  if (cached && !forceRefresh) {
    return cached;
  }

  const people = await loadPeopleConfig();
  const payload = await buildDashboardFromPeople(people);
  await saveDashboardPayload(payload);
  return payload;
}
