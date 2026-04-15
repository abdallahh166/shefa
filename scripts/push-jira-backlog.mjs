import { readFileSync } from "node:fs";
import process from "node:process";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      current = "";
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  const [header, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(header.map((name, index) => [name, record[index] ?? ""])),
  );
}

function adfParagraph(text) {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

function toAdf(row) {
  const blocks = [];

  if (row.Description) {
    blocks.push(adfParagraph(row.Description));
  }

  if (row.Effort || row.Dependencies) {
    const items = [];
    if (row.Effort) items.push(`Effort: ${row.Effort}`);
    if (row.Dependencies) items.push(`Dependencies: ${row.Dependencies}`);
    blocks.push(adfParagraph(items.join(" | ")));
  }

  if (row["Acceptance Criteria"]) {
    const criteria = row["Acceptance Criteria"]
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);

    if (criteria.length > 0) {
      blocks.push(adfParagraph("Acceptance Criteria"));
      blocks.push({
        type: "bulletList",
        content: criteria.map((criterion) => ({
          type: "listItem",
          content: [adfParagraph(criterion)],
        })),
      });
    }
  }

  return {
    version: 1,
    type: "doc",
    content: blocks.length > 0 ? blocks : [adfParagraph("Imported from production readiness backlog.")],
  };
}

function toLabels(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function jiraRequest(path, body) {
  const site = requireEnv("JIRA_SITE").replace(/\/+$/, "");
  const email = requireEnv("JIRA_EMAIL");
  const token = requireEnv("JIRA_TOKEN");
  const auth = Buffer.from(`${email}:${token}`).toString("base64");

  const response = await fetch(`${site}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`Jira API error ${response.status}: ${text}`);
  }

  return data;
}

async function createIssue(projectKey, row, epicKey) {
  const summaryPrefix = row["Issue ID"] ? `${row["Issue ID"]} ` : "";
  const fields = {
    project: { key: projectKey },
    issuetype: { name: row["Issue Type"] },
    summary: `${summaryPrefix}${row.Summary}`.trim(),
    description: toAdf(row),
    labels: toLabels(row.Labels),
  };

  if (row.Priority) {
    fields.priority = { name: row.Priority };
  }

  if (epicKey) {
    fields.parent = { key: epicKey };
  }

  try {
    return await jiraRequest("/rest/api/3/issue", { fields });
  } catch (error) {
    const message = String(error.message ?? error);
    if (message.includes("priority")) {
      delete fields.priority;
      return jiraRequest("/rest/api/3/issue", { fields });
    }
    throw error;
  }
}

async function main() {
  const projectKey = process.env.JIRA_PROJECT || "SCRUM";
  const csvPath = process.argv[2] || "docs/production-readiness-backlog-jira.csv";
  const rows = parseCsv(readFileSync(csvPath, "utf8"));

  const epicRows = rows.filter((row) => row["Issue Type"] === "Epic");
  const childRows = rows.filter((row) => row["Issue Type"] !== "Epic");

  const epicKeyById = new Map();

  for (const row of epicRows) {
    const created = await createIssue(projectKey, row, null);
    epicKeyById.set(row["Issue ID"], created.key);
    console.log(`Created epic ${row["Issue ID"]} -> ${created.key}`);
  }

  for (const row of childRows) {
    const epicLink = row["Epic Link"] || "";
    const epicKey = epicLink ? epicKeyById.get(epicLink) : null;
    const created = await createIssue(projectKey, row, epicKey);
    console.log(`Created issue ${row["Issue ID"]} -> ${created.key}`);
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
