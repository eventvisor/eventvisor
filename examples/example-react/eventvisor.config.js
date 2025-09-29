const path = require("path");

module.exports = {
  tags: ["web"],

  // custom paths
  eventsDirectoryPath: path.join(__dirname, "eventvisor-project", "events"),
  attributesDirectoryPath: path.join(__dirname, "eventvisor-project", "attributes"),
  destinationsDirectoryPath: path.join(__dirname, "eventvisor-project", "destinations"),
  effectsDirectoryPath: path.join(__dirname, "eventvisor-project", "effects"),
  testsDirectoryPath: path.join(__dirname, "eventvisor-project", "tests"),
};
