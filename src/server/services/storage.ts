import { mkdir, readFile, writeFile, access, copyFile } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";

import type { DashboardPayload, PersonConfig } from "../../shared/types.js";

const ROOT_DIR = process.cwd();
const DEFAULT_DATA_DIR = path.join(ROOT_DIR, "data");
const RUNTIME_DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : DEFAULT_DATA_DIR;

const PEOPLE_FILE = "people.json";
const DASHBOARD_FILE = "appreciations.json";

async function fileExists(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureDataDirectory() {
  await mkdir(RUNTIME_DATA_DIR, { recursive: true });

  const defaultPeoplePath = path.join(DEFAULT_DATA_DIR, PEOPLE_FILE);
  const runtimePeoplePath = path.join(RUNTIME_DATA_DIR, PEOPLE_FILE);

  if (RUNTIME_DATA_DIR !== DEFAULT_DATA_DIR && !(await fileExists(runtimePeoplePath))) {
    await copyFile(defaultPeoplePath, runtimePeoplePath);
  }
}

export async function loadPeopleConfig() {
  await ensureDataDirectory();
  const filePath = path.join(RUNTIME_DATA_DIR, PEOPLE_FILE);
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as PersonConfig[];
}

export async function loadDashboardPayload() {
  await ensureDataDirectory();
  const filePath = path.join(RUNTIME_DATA_DIR, DASHBOARD_FILE);

  if (!(await fileExists(filePath))) {
    return null;
  }

  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as DashboardPayload;
}

export async function saveDashboardPayload(payload: DashboardPayload) {
  await ensureDataDirectory();
  const filePath = path.join(RUNTIME_DATA_DIR, DASHBOARD_FILE);
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

export function getRuntimeDataDirectory() {
  return RUNTIME_DATA_DIR;
}
