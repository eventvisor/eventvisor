import type {
  Event,
  EventName,
  Attribute,
  AttributeName,
  Destination,
  DestinationName,
  Effect,
  EffectName,
  Test,
  TestName,
  DatafileContent,
  EntityType,
  Target,
  TargetKey,
  Schema,
  SchemaKey,
} from "@eventvisor/types";

import { ProjectConfig, CustomParser, getProjectConfigForSet } from "../config";

import { Adapter, DatafileOptions } from "./adapter";

export class Datasource {
  private adapter: Adapter;

  constructor(
    private config: ProjectConfig,
    private rootDirectoryPath?: string,
  ) {
    this.adapter = new config.adapter(config, rootDirectoryPath);
  }

  getConfig() {
    return this.config;
  }

  forSet(set: string) {
    return new Datasource(getProjectConfigForSet(this.config, set), this.rootDirectoryPath);
  }

  listSets() {
    return this.adapter.listSets();
  }

  // @NOTE: only site generator needs it, find a way to get it out of here later
  getExtension() {
    return (this.config.parser as CustomParser).extension;
  }

  /**
   * Revision
   */
  readRevision() {
    return this.adapter.readRevision();
  }

  writeRevision(revision: string) {
    return this.adapter.writeRevision(revision);
  }

  /**
   * Datafile
   */
  readDatafile(options: DatafileOptions) {
    return this.adapter.readDatafile(options);
  }

  writeDatafile(datafileContent: DatafileContent, options: DatafileOptions) {
    return this.adapter.writeDatafile(datafileContent, options);
  }

  /**
   * Entity specific methods
   */

  // events
  listEvents() {
    return this.adapter.listEntities("event");
  }

  eventExists(eventName: EventName) {
    return this.adapter.entityExists("event", eventName);
  }

  readEvent(eventName: EventName) {
    return this.adapter.readEntity<Event>("event", eventName);
  }

  writeEvent(eventName: EventName, event: Event) {
    return this.adapter.writeEntity<Event>("event", eventName, event);
  }

  deleteEvent(eventName: EventName) {
    return this.adapter.deleteEntity("event", eventName);
  }

  // attributes
  listAttributes() {
    return this.adapter.listEntities("attribute");
  }

  attributeExists(attributeName: AttributeName) {
    return this.adapter.entityExists("attribute", attributeName);
  }

  readAttribute(attributeName: AttributeName) {
    return this.adapter.readEntity<Attribute>("attribute", attributeName);
  }

  writeAttribute(attributeName: AttributeName, attribute: Attribute) {
    return this.adapter.writeEntity<Attribute>("attribute", attributeName, attribute);
  }

  deleteAttribute(attributeName: AttributeName) {
    return this.adapter.deleteEntity("attribute", attributeName);
  }

  // destinations
  listDestinations() {
    return this.adapter.listEntities("destination");
  }

  destinationExists(destinationName: DestinationName) {
    return this.adapter.entityExists("destination", destinationName);
  }

  readDestination(destinationName: DestinationName) {
    return this.adapter.readEntity<Destination>("destination", destinationName);
  }

  writeDestination(destinationName: DestinationName, destination: Destination) {
    return this.adapter.writeEntity<Destination>("destination", destinationName, destination);
  }

  deleteDestination(destinationName: DestinationName) {
    return this.adapter.deleteEntity("destination", destinationName);
  }

  // effects
  listEffects() {
    return this.adapter.listEntities("effect");
  }

  effectExists(effectName: EffectName) {
    return this.adapter.entityExists("effect", effectName);
  }

  readEffect(effectName: EffectName) {
    return this.adapter.readEntity<Effect>("effect", effectName);
  }

  writeEffect(effectName: EffectName, effect: Effect) {
    return this.adapter.writeEntity<Effect>("effect", effectName, effect);
  }

  deleteEffect(effectName: EffectName) {
    return this.adapter.deleteEntity("effect", effectName);
  }

  // reusable schemas
  listSchemas() {
    return this.adapter.listEntities("schema");
  }

  schemaExists(schemaKey: SchemaKey) {
    return this.adapter.entityExists("schema", schemaKey);
  }

  readSchema(schemaKey: SchemaKey) {
    return this.adapter.readEntity<Schema>("schema", schemaKey);
  }

  writeSchema(schemaKey: SchemaKey, schema: Schema) {
    return this.adapter.writeEntity<Schema>("schema", schemaKey, schema);
  }

  deleteSchema(schemaKey: SchemaKey) {
    return this.adapter.deleteEntity("schema", schemaKey);
  }

  // tests
  listTests() {
    return this.adapter.listEntities("test");
  }

  readTest(testName: TestName) {
    return this.adapter.readEntity<Test>("test", testName);
  }

  testExists(testName: TestName) {
    return this.adapter.entityExists("test", testName);
  }

  writeTest(testName: TestName, test: Test) {
    return this.adapter.writeEntity<Test>("test", testName, test);
  }

  deleteTest(testName: TestName) {
    return this.adapter.deleteEntity("test", testName);
  }

  getTestSpecName(testName: TestName) {
    return `${testName}.${this.getExtension()}`;
  }

  // targets
  listTargets() {
    return this.adapter.listEntities("target");
  }

  targetExists(targetKey: TargetKey) {
    return this.adapter.entityExists("target", targetKey);
  }

  readTarget(targetKey: TargetKey) {
    return this.adapter.readEntity<Target>("target", targetKey);
  }

  writeTarget(targetKey: TargetKey, target: Target) {
    return this.adapter.writeEntity<Target>("target", targetKey, target);
  }

  deleteTarget(targetKey: TargetKey) {
    return this.adapter.deleteEntity("target", targetKey);
  }

  // history
  listHistoryEntries(entityType?: EntityType, entityKey?: string) {
    return this.adapter.listHistoryEntries(entityType, entityKey);
  }

  readCommit(commitHash: string, entityType?: EntityType, entityKey?: string) {
    return this.adapter.readCommit(commitHash, entityType, entityKey);
  }
}
