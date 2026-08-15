const REPOSITORY = "OzansanT/CREED";
const WEB_URL = `https://github.com/${REPOSITORY}`;
const API_URL = `https://api.github.com/repos/${REPOSITORY}`;

function externalLink(label, href) {
  const link = document.createElement("a");
  link.className = "activity-action-link";
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = label;
  return link;
}

export function createGitHubView({ notify }) {
  return function renderGitHub(container) {
    const root = document.createElement("div");
    const section = document.createElement("section");
    section.className = "activity-section";
    const heading = document.createElement("h2");
    heading.textContent = `GitHub · ${REPOSITORY}`;
    const status = document.createElement("p");
    status.textContent = "Loading public repository metadata…";
    const actions = document.createElement("div");
    actions.className = "activity-actions";
    actions.append(
      externalLink("Repository", WEB_URL),
      externalLink("Pull requests", WEB_URL + "/pulls"),
      externalLink("Issues", WEB_URL + "/issues"),
      externalLink("Actions", WEB_URL + "/actions")
    );
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy clone URL";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(WEB_URL + ".git");
        notify?.("Clone URL copied");
      } catch {
        notify?.(WEB_URL + ".git");
      }
    });
    actions.append(copy);
    const issueActions = document.createElement("div");
    issueActions.className = "activity-actions";
    issueActions.append(
      externalLink("New issue", WEB_URL + "/issues/new/choose"),
      externalLink("Compare branches", WEB_URL + "/compare")
    );
    section.append(heading, status, actions, issueActions);
    root.append(section);
    container.replaceChildren(root);
    const controller = new AbortController();
    fetch(API_URL, { headers: { Accept: "application/vnd.github+json" }, signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
        return response.json();
      })
      .then((repo) => {
        status.textContent = `${repo.description || "CREED repository"}\nDefault branch: ${repo.default_branch} · ${repo.open_issues_count} open issues/PRs · ★ ${repo.stargazers_count} · Updated ${new Date(repo.updated_at).toLocaleString()}`;
      })
      .catch((error) => {
        if (error.name !== "AbortError") status.textContent = `Public metadata unavailable: ${error.message}. Repository links remain available.`;
      });
    return () => controller.abort();
  };
}
