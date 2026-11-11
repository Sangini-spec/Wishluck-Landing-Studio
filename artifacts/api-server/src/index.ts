import app from "./app";
import { logger } from "./lib/logger";
import { recoverInterruptedJobs } from "./lib/store";
import {initialiseStoreSelection} from "./lib/shopify-selection";
import {recoverDurableJobs} from "./lib/durable-jobs";
import {recoverCliUpload} from "./lib/shopify-cli";
import {recoverAudit} from "./lib/audit";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

Promise.all([recoverInterruptedJobs(),initialiseStoreSelection()]).then(()=>app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void recoverDurableJobs(job=>job.kind==="upload"?recoverCliUpload(job):recoverAudit(job))
    .catch(()=>logger.warn("Interrupted publishing jobs could not be reconciled; saved receipts retained."));
})).catch(()=>{logger.error("Cannot initialise the database-backed job state.");process.exit(1);});
