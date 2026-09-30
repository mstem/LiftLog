import type { BigNumberJSON } from '../libs';

export interface NoProgressiveOverloadJSON {
  readonly type: 'NoProgressiveOverload';
}

export interface IncreaseAllEvenlyProgressiveOverloadJSON {
  readonly type: 'IncreaseAllEvenlyProgressiveOverload';
  readonly amount: BigNumberJSON;
}

type IncreaseStrategyJSON = 'first' | 'middle' | 'last' | 'all';

export interface IncreaseLowestSetProgressiveOverloadJSON {
  readonly type: 'IncreaseLowestSetProgressiveOverload';
  readonly amount: BigNumberJSON;
  readonly increaseStrategy: IncreaseStrategyJSON;
}

export interface AdjustByRepsProgressiveOverloadJSON {
  readonly type: 'AdjustByRepsProgressiveOverload';
  readonly amount: BigNumberJSON;
}

/**
 * @discriminator type
 */
export type ProgressiveOverloadJSON =
  | NoProgressiveOverloadJSON
  | IncreaseAllEvenlyProgressiveOverloadJSON
  | IncreaseLowestSetProgressiveOverloadJSON
  | AdjustByRepsProgressiveOverloadJSON;
