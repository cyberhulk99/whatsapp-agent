import chalk from "chalk";
import type { SummaryReport } from "./types.js";

/**
 * Pretty-print the summary report to the console.
 */
export function printReport(report: SummaryReport): void {
  const time = report.generatedAt.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  console.log("\n" + chalk.bold.blue("═".repeat(60)));
  console.log(
    chalk.bold.blue(`  WhatsApp Summary — Last ${report.hoursBack}h  (generated ${time})`)
  );
  console.log(chalk.bold.blue("═".repeat(60)));
  console.log(
    chalk.gray(`  ${report.totalMessages} messages across ${report.chatSummaries.length} chats\n`)
  );

  // ── Mentions first ──────────────────────────────────────────
  if (report.allMentions.length > 0) {
    console.log(chalk.bold.yellow("🔔  YOU WERE MENTIONED"));
    console.log(chalk.yellow("─".repeat(60)));
    for (const m of report.allMentions) {
      const time = new Date(m.timestamp).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      console.log(
        chalk.yellow(`  [${time}] `) +
          chalk.bold(m.chatName) +
          chalk.gray(" › ") +
          chalk.cyan(m.sender) +
          ": " +
          chalk.white(m.body)
      );
    }
    console.log();
  } else {
    console.log(chalk.green("  ✓ No mentions in the last " + report.hoursBack + " hours\n"));
  }

  // ── Per-chat summaries ──────────────────────────────────────
  for (const chat of report.chatSummaries) {
    console.log(
      chalk.bold.green(`📬  ${chat.chatName}`) +
        chalk.gray(` (${chat.messageCount} msgs)`)
    );
    console.log(chalk.green("─".repeat(60)));
    const lines = chat.summary.split("\n");
    for (const line of lines) {
      console.log("  " + line);
    }
    console.log();
  }

  console.log(chalk.bold.blue("═".repeat(60)) + "\n");
}
