import { execFileSync } from "child_process";

import { getOwnerAndRepoFromUrl } from "./getOwnerAndRepoFromUrl";

export interface RepoDetails {
  provider: "github" | "gitlab" | "bitbucket";
  repository: string;
  branch: string;
  remoteUrl: string;
  blobUrl: string;
  commitUrl: string;
  topLevelPath: string;
}

function runGit(rootDirectoryPath: string, args: string[]) {
  return execFileSync("git", ["-C", rootDirectoryPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

export function getRepoDetails(rootDirectoryPath = process.cwd()): RepoDetails | undefined {
  try {
    const topLevelPath = runGit(rootDirectoryPath, ["rev-parse", "--show-toplevel"]);
    const remoteUrl = runGit(rootDirectoryPath, ["remote", "get-url", "origin"]);
    const branch = runGit(rootDirectoryPath, ["rev-parse", "--abbrev-ref", "HEAD"]);

    if (!remoteUrl || !branch) {
      return;
    }

    const { owner, repo } = getOwnerAndRepoFromUrl(remoteUrl);

    if (!owner || !repo) {
      return;
    }

    let blobUrl;
    let commitUrl;
    let repository;
    let provider: RepoDetails["provider"];

    if (remoteUrl.indexOf("github.com") > -1) {
      provider = "github";
      repository = `https://github.com/${owner}/${repo}`;
      blobUrl = `https://github.com/${owner}/${repo}/blob/${branch}/{{blobPath}}`;
      commitUrl = `https://github.com/${owner}/${repo}/commit/{{hash}}`;
    } else if (remoteUrl.indexOf("gitlab.com") > -1) {
      provider = "gitlab";
      repository = `https://gitlab.com/${owner}/${repo}`;
      blobUrl = `https://gitlab.com/${owner}/${repo}/-/blob/${branch}/{{blobPath}}`;
      commitUrl = `https://gitlab.com/${owner}/${repo}/-/commit/{{hash}}`;
    } else if (remoteUrl.indexOf("bitbucket.org") > -1) {
      provider = "bitbucket";
      repository = `https://bitbucket.org/${owner}/${repo}`;
      blobUrl = `https://bitbucket.org/${owner}/${repo}/src/${branch}/{{blobPath}}`;
      commitUrl = `https://bitbucket.org/${owner}/${repo}/commits/{{hash}}`;
    }

    if (!provider || !repository || !blobUrl || !commitUrl) {
      return;
    }

    return {
      provider,
      repository,
      branch,
      remoteUrl,
      blobUrl,
      commitUrl,
      topLevelPath,
    };
  } catch {
    return;
  }
}
