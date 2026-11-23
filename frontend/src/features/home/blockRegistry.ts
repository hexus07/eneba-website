import type { ComponentType } from 'react';
import { HeroBannerBlock, HeroBannerSkeleton } from './blocks/HeroBannerBlock';
import { PlatformTilesBlock, PlatformTilesSkeleton } from './blocks/PlatformTilesBlock';
import { DealsBlock, ProductRowBlock, ProductRowSkeleton } from './blocks/ProductRowBlock';
import type { HomeLayoutBlock } from './types';

export interface BlockDefinition {
  /** Fetches its own content (useHomeBlock) and renders it; renders nothing when empty. */
  Component: ComponentType<{ block: HomeLayoutBlock }>;
  /** Shown while that block's content loads. */
  Skeleton: ComponentType<{ block: HomeLayoutBlock }>;
}

/**
 * home_blocks.type → component (mirrors backend config/home.php). The homepage renders ONLY what
 * GET /home returns, through this map: a type missing here renders nothing.
 */
export const blockRegistry: Readonly<Record<string, BlockDefinition | undefined>> = {
  hero_banner: { Component: HeroBannerBlock, Skeleton: HeroBannerSkeleton },
  best_sellers: { Component: ProductRowBlock, Skeleton: ProductRowSkeleton },
  new_releases: { Component: ProductRowBlock, Skeleton: ProductRowSkeleton },
  by_platform: { Component: ProductRowBlock, Skeleton: ProductRowSkeleton },
  deals: { Component: DealsBlock, Skeleton: ProductRowSkeleton },
  platform_tiles: { Component: PlatformTilesBlock, Skeleton: PlatformTilesSkeleton },
};
