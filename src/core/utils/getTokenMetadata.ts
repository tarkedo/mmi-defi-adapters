import { Erc20__factory } from '../../contracts'
import { Chain } from '../constants/chains'
import TOKEN_METADATA_ARBITRUM from '../metadata/token-metadata-arbitrum.json'
import TOKEN_METADATA_ETHEREUM from '../metadata/token-metadata-ethereum.json'
import { chainProviders } from './chainProviders'
import { extractErrorMessage } from './error'
import { logger } from './logger'

export type ERC20 = {
  address: string
  name: string
  symbol: string
  decimals: number
  iconUrl?: string
}

const CHAIN_METADATA: Partial<
  Record<Chain, Record<string, ERC20 | undefined>>
> = {
  [Chain.Ethereum]: TOKEN_METADATA_ETHEREUM,
  [Chain.Arbitrum]: TOKEN_METADATA_ARBITRUM,
}

export const getTokenMetadata = async ({
  tokenAddress,
  chainId,
  throwOnFailure = false,
}: {
  tokenAddress: string
  chainId: Chain
  throwOnFailure?: boolean
}): Promise<ERC20> => {
  const fileMetadata = CHAIN_METADATA[chainId]
  if (fileMetadata) {
    const fileTokenMetadata = fileMetadata[tokenAddress]
    if (fileTokenMetadata) {
      logger.debug(
        { tokenAddress, chainId },
        'Token metadata found on cached file',
      )
      return fileTokenMetadata
    }
  }

  const onChainTokenMetadata = await getOnChainTokenMetadata(
    tokenAddress,
    chainId,
  )
  if (onChainTokenMetadata) {
    logger.debug({ tokenAddress, chainId }, 'Token metadata found on chain')
    return onChainTokenMetadata
  }

  const errorMessage = 'Cannot find token metadata for token'
  if (throwOnFailure) {
    logger.error({ tokenAddress, chainId }, errorMessage)
    throw new Error(errorMessage)
  }

  logger.warn({ tokenAddress, chainId }, errorMessage)
  return {
    address: tokenAddress,
    name: '',
    symbol: '',
    decimals: 18,
  }
}

const getOnChainTokenMetadata = async (
  tokenAddress: string,
  chainId: Chain,
): Promise<ERC20 | undefined> => {
  const provider = chainProviders[chainId]
  if (!provider) {
    return undefined
  }

  const tokenContract = Erc20__factory.connect(tokenAddress, provider)

  try {
    const name = await tokenContract.name()
    const symbol = await tokenContract.symbol()
    const decimals = await tokenContract.decimals()
    return {
      address: tokenContract.address.toLowerCase(),
      name,
      symbol,
      decimals,
    }
  } catch (error) {
    const errorMessage = extractErrorMessage(error)
    logger.warn(
      { tokenAddress, chainId, errorMessage },
      'Failed to fetch token metadata on-chain',
    )
    return undefined
  }
}
