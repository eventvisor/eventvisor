import type { Sample, SampleBy, Inputs } from "@eventvisor/types";

import type { Logger } from "./logger";
import { MurmurHashV3 } from "./murmurhash";
import type { SourceResolver } from "./sourceResolver";
import type { ConditionsChecker } from "./conditions";
import type { Transformer } from "./transformer";

export type BucketKey = string;
export type BucketValue = number; // 0 to 100,000 (100% * 1000 to include three decimal places in same integer)

/**
 * Generic hashing
 */
const HASH_SEED = 1;
const MAX_HASH_VALUE = Math.pow(2, 32);

export const MAX_BUCKETED_NUMBER = 100000; // 100% * 1000 to include three decimal places in the same integer value

export function getBucketedNumber(bucketKey: string): BucketValue {
  const hashValue = MurmurHashV3(bucketKey, HASH_SEED);
  const ratio = hashValue / MAX_HASH_VALUE;

  return Math.floor(ratio * MAX_BUCKETED_NUMBER);
}

/**
 * Bucket key
 */
const DEFAULT_BUCKET_KEY_SEPARATOR = ".";

export class BucketerOptions {
  logger: Logger;
  sourceResolver: SourceResolver;
  conditionsChecker: ConditionsChecker;
  transformer: Transformer;
}

export interface SampleResult {
  isSampled: boolean;
  matchedSample?: Sample;
  bucketedNumber?: number;
  bucketKey?: BucketKey;
}

export class Bucketer {
  private logger: Logger;
  private sourceResolver: SourceResolver;
  private conditionsChecker: ConditionsChecker;
  private transformer: Transformer;

  constructor(options: BucketerOptions) {
    this.logger = options.logger;
    this.sourceResolver = options.sourceResolver;
    this.conditionsChecker = options.conditionsChecker;
    this.transformer = options.transformer;
  }

  async getBucketKey(sampleBy: SampleBy, inputs: Inputs): Promise<BucketKey> {
    let type;
    let sources;

    if (typeof sampleBy === "string") {
      type = "plain";
      sources = [sampleBy];
    } else if (Array.isArray(sampleBy)) {
      type = "and";
      sources = sampleBy;
    } else if (typeof sampleBy === "object" && "or" in sampleBy && Array.isArray(sampleBy.or)) {
      type = "or";
      sources = sampleBy.or;
    } else if (typeof sampleBy === "object") {
      type = "and";
      sources = [sampleBy];
    } else {
      this.logger.error("invalid sampleBy", { sampleBy });

      throw new Error("invalid sampleBy");
    }

    const bucketKey: string[] = [];

    for (const source of sources) {
      const sourceValue = await this.sourceResolver.resolve(source, inputs);

      if (typeof sourceValue === "undefined") {
        continue;
      }

      if (type === "plain" || type === "and") {
        bucketKey.push(String(sourceValue));
      } else {
        // or
        if (bucketKey.length === 0) {
          bucketKey.push(String(sourceValue));
        }
      }
    }

    return bucketKey.join(DEFAULT_BUCKET_KEY_SEPARATOR);
  }

  async isSampled(sample: Sample | Sample[], inputs: Inputs): Promise<SampleResult> {
    const samples = Array.isArray(sample) ? sample : [sample];

    const matchedSample = samples.find(async (sample) => {
      if (!sample.conditions) {
        return true;
      }

      const isMatched = await this.conditionsChecker.allAreMatched(sample.conditions, inputs);

      return isMatched;
    });

    if (matchedSample) {
      const bucketKey = await this.getBucketKey(matchedSample.by, inputs);

      const bucketedNumber = getBucketedNumber(bucketKey);

      if (
        matchedSample.percentage &&
        matchedSample.percentage > 0 &&
        bucketedNumber < matchedSample.percentage
      ) {
        return {
          isSampled: false,
          matchedSample,
          bucketedNumber,
          bucketKey,
        };
      }

      if (
        matchedSample.range &&
        bucketedNumber < matchedSample.range[0] &&
        bucketedNumber > matchedSample.range[1]
      ) {
        return {
          isSampled: false,
          matchedSample,
          bucketedNumber,
          bucketKey,
        };
      }
    }

    return {
      isSampled: true,
    };
  }
}
