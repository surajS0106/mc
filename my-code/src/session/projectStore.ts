import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { myCodeDir } from "../config/globalConfig.js";

export interface ProjectMeta {
  cwd: string;
  hash: string;
  createdAt: number;
}

export function hashProject(cwd: string): string {
  return createHash("sha256").update(cwd).digest("hex").slice(0, 16);
}

export function projectDir(cwd: string): string {
  return path.join(myCodeDir(), "projects", hashProject(cwd));
}

export function sessionDir(cwd: string): string {
  return path.join(projectDir(cwd), "sessions");
}

export async function ensureProjectMeta(cwd: string): Promise<void> {
  const dir = projectDir(cwd);
  const metaPath = path.join(dir, "meta.json");
  try {
    await fs.access(metaPath);
  } catch {
    await fs.mkdir(dir, { recursive: true });
    const meta: ProjectMeta = { cwd, hash: hashProject(cwd), createdAt: Date.now() };
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
  }
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const projectsDir = path.join(myCodeDir(), "projects");
  try {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    const metas: ProjectMeta[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      try {
        const txt = await fs.readFile(
          path.join(projectsDir, e.name, "meta.json"),
          "utf8"
        );
        metas.push(JSON.parse(txt) as ProjectMeta);
      } catch {}
    }
    return metas;
  } catch {
    return [];
  }
}
