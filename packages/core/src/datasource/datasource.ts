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
} from "@eventvisor/types";

import { ProjectConfig, CustomParser } from "../config";

import { Adapter, DatafileOptions } from "./adapter";

export class Datasource {
  private adapter: Adapter;

  constructor(
    private config: ProjectConfig,
    private rootDirectoryPath?: string,
  ) {
    this.adapter = new config.adapter(config, rootDirectoryPath);
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

  // tests
  listTests() {
    return this.adapter.listEntities("test");
  }

  readTest(testName: TestName) {
    return this.adapter.readEntity<Test>("test", testName);
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
}
